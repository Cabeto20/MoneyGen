import { affordability, installmentPlan } from '../../projections';
import { getPendingBillsTotal } from '../../billHelpers';
import { daysInMonth, getMonthLabel } from '../../dateHelpers';
import { ok, noData, textBlock, valueBlock } from '../result';
import { money, count, percent } from '../replies';
import { SUGGESTIONS } from '../suggestions';

/** Saldo livre do mês: o que há menos o que ainda vai sair em contas. */
const freeNow = async (snapshot) => {
  const [balance, bills] = await Promise.all([snapshot.balance(), snapshot.bills()]);
  const pending = getPendingBillsTotal(bills, snapshot.now.getMonth(), snapshot.now.getFullYear());
  return { balance: balance.balance, pending };
};

const VERDICT_TEXT = {
  folgado: 'Dá tranquilo',
  justo: 'Dá, mas fica justo',
  estoura: 'Não dá sem ficar no vermelho',
};

export const canISpend = {
  id: 'can_i_spend',
  priority: 3,
  patterns: [
    /\b(?:posso|da pra|consigo|tenho como) (?:gastar|comprar|torrar|pagar)\b/,
    /\bcabe no (?:meu )?(?:or[cç]amento|bolso)\b/,
    /\bda pra comprar\b/,
    /\bposso me dar ao luxo\b/,
  ],
  keywordGroups: [
    ['posso', 'consigo', 'da pra', 'tenho como', 'cabe'],
    ['gastar', 'comprar', 'torrar', 'pagar', 'cabe'],
  ],
  requiredGroups: [0, 1],
  requires: ['amount'],
  optional: ['period', 'category'],
  run: async (entities, snapshot) => {
    const { balance, pending } = await freeNow(snapshot);

    let budgetRemaining = null;
    if (entities.category.confident) {
      const statuses = await snapshot.budgetStatus(snapshot.now.getMonth(), snapshot.now.getFullYear());
      const found = statuses.find((item) => item.category === entities.category.value);
      if (found) budgetRemaining = found.remaining;
    }

    const result = affordability({
      balance,
      pendingBillsAmount: pending,
      amount: entities.amount,
      budgetRemaining,
    });

    const parts = [
      `${VERDICT_TEXT[result.verdict]}: saldo ${money(balance)} menos ${money(pending)} em contas em aberto deixa ${money(result.free)} livres.`,
      result.afterSpending >= 0
        ? `Gastando ${money(entities.amount)}, sobram ${money(result.afterSpending)}.`
        : `Gastando ${money(entities.amount)}, faltariam ${money(Math.abs(result.afterSpending))}.`,
    ];

    if (result.exceedsBudget) {
      parts.push(`Atenção: seu orçamento de ${entities.category.value} só tem ${money(budgetRemaining)} disponíveis.`);
    }

    const text = parts.join(' ');

    return ok('can_i_spend', text, {
      blocks: [
        textBlock(text),
        valueBlock('Livre depois disso', result.afterSpending, result.afterSpending >= 0 ? 'positivo' : 'negativo'),
      ],
      data: { ...result, amount: entities.amount, balance, pending },
      suggestions: [SUGGESTIONS.daily, SUGGESTIONS.leftover, SUGGESTIONS.billsDue],
    });
  },
};

export const simulateInstallments = {
  id: 'simulate_installments',
  priority: 3,
  patterns: [
    /\bparcel(?:ar|o|ado|ando)\b/,
    /\bdividir em\b/,
    /\bem \d{1,3}\s*x\b/,
    /\bse eu (?:parcelar|dividir)\b/,
  ],
  keywordGroups: [['parcel', 'dividir', 'vezes', 'prestacao', 'prestacoes']],
  requiredGroups: [0],
  requires: ['amount', 'installments'],
  run: async (entities, snapshot) => {
    const { balance, pending } = await freeNow(snapshot);
    const monthlyLeftover = balance - pending;

    const plan = installmentPlan(entities.amount, entities.installments, {
      startDate: snapshot.now,
      monthlyLeftover,
    });

    if (!plan) return noData('simulate_installments', 'Não consegui simular esse parcelamento.');

    const window = `de ${getMonthLabel(plan.first.month, plan.first.year)} a ${getMonthLabel(plan.last.month, plan.last.year)}`;
    const parts = [
      `${plan.count}x de ${money(plan.installment)}, ${window}.`,
    ];

    if (plan.shareOfLeftover !== null) {
      const share = percent(plan.shareOfLeftover);
      parts.push(
        plan.shareOfLeftover > 1
          ? `Cada parcela é maior que a sua folga atual de ${money(monthlyLeftover)} — não cabe.`
          : `Isso come ${share} da sua folga atual de ${money(monthlyLeftover)}.`
      );
    }

    const text = parts.join(' ');

    return ok('simulate_installments', text, {
      blocks: [textBlock(text), valueBlock('Parcela', plan.installment, 'neutro')],
      data: { ...plan, monthlyLeftover },
      suggestions: [SUGGESTIONS.canSpend, SUGGESTIONS.leftover],
    });
  },
};

export const dailyAllowance = {
  id: 'daily_allowance',
  priority: 3,
  patterns: [
    /\bpor dia\b/,
    /\bquanto (?:posso|da pra) gastar (?:por|ao) dia\b/,
    /\bteto diario\b/,
    /\bpor dia ate o fim do mes\b/,
  ],
  keywordGroups: [['por dia', 'ao dia', 'diario', 'diaria']],
  requiredGroups: [0],
  run: async (entities, snapshot) => {
    const { balance, pending } = await freeNow(snapshot);
    const free = balance - pending;

    const total = daysInMonth(snapshot.now.getMonth(), snapshot.now.getFullYear());
    // O dia de hoje ainda conta: quem pergunta às 14h ainda vai gastar hoje.
    const daysLeft = Math.max(1, total - snapshot.now.getDate() + 1);

    if (free <= 0) {
      const text = `Com ${money(balance)} de saldo e ${money(pending)} em contas em aberto, não sobra margem diária — a conta já fecha negativa em ${money(Math.abs(free))}.`;
      return ok('daily_allowance', text, {
        blocks: [textBlock(text), valueBlock('Livre', free, 'negativo')],
        data: { free, daysLeft, balance, pending },
        suggestions: [SUGGESTIONS.billsDue, SUGGESTIONS.topCategories],
      });
    }

    const perDay = free / daysLeft;
    const text = `Faltam ${count(daysLeft, 'dia', 'dias')} no mês e você tem ${money(free)} livres — dá ${money(perDay)} por dia até o fim do mês.`;

    return ok('daily_allowance', text, {
      blocks: [textBlock(text), valueBlock('Por dia', perDay, 'neutro')],
      data: { free, daysLeft, perDay, balance, pending },
      suggestions: [SUGGESTIONS.canSpend, SUGGESTIONS.budgets],
    });
  },
};

export default [canISpend, simulateInstallments, dailyAllowance];

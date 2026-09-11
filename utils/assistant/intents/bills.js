import {
  filterBillsByMonth,
  isBillPaidForMonth,
  getBillDueDateFor,
  getPendingBillsTotal,
} from '../../billHelpers';
import { detectBillAmountChanges } from '../../analytics';
import { addMonths, daysUntil, getMonthLabel } from '../../dateHelpers';
import { leftoverAfterBills } from '../../projections';
import { ok, noData, textBlock, valueBlock, listBlock } from '../result';
import { money, count, percent, NO_DATA, capitalize } from '../replies';
import { SUGGESTIONS } from '../suggestions';

/**
 * Contas em aberto com vencimento dentro da janela. Varre o mês corrente e o
 * seguinte porque uma janela de "próximos 7 dias" no fim do mês atravessa a
 * virada — só o mês corrente deixaria de fora justamente o que vence primeiro.
 */
const openBillsUntil = (bills, now, until) => {
  const windows = [
    { month: now.getMonth(), year: now.getFullYear() },
    addMonths(now.getMonth(), now.getFullYear(), 1),
  ];

  const items = [];
  windows.forEach(({ month, year }) => {
    filterBillsByMonth(bills, month, year)
      .filter((bill) => !isBillPaidForMonth(bill, month, year))
      .forEach((bill) => {
        const dueDate = getBillDueDateFor(bill, month, year);
        if (dueDate > until) return;
        items.push({ bill, month, year, dueDate, days: daysUntil(dueDate) });
      });
  });

  return items.sort((a, b) => a.dueDate - b.dueDate);
};

const dueLabel = (days) => {
  if (days < 0) return `vencida há ${count(Math.abs(days), 'dia', 'dias')}`;
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence amanhã';
  return `vence em ${days} dias`;
};

export const billsDue = {
  id: 'bills_due',
  priority: 2,
  patterns: [
    /\bo que vence\b/,
    /\bvence (?:alguma|algo|hoje|amanha|essa|esta)\b/,
    /\b(?:quais|que) contas?\b/,
    /\bcontas? (?:a|para|pra) (?:pagar|vencer)\b/,
    /\btenho conta\b/,
    /\bproximos? vencimentos?\b/,
  ],
  keywordGroups: [['vence', 'vencer', 'vencimento', 'vencimentos', 'conta', 'contas', 'fatura', 'boleto']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const bills = await snapshot.bills();
    if (bills.length === 0) return noData('bills_due', NO_DATA.bills);

    const period = entities.periodOrDefault;
    const until = period.end;
    const items = openBillsUntil(bills, snapshot.now, until);

    if (items.length === 0) {
      const text = `Nenhuma conta em aberto vencendo ${period.assumed ? 'até o fim do mês' : period.label}. Está tudo em dia por aqui.`;
      return ok('bills_due', text, {
        data: { items: [] },
        suggestions: [SUGGESTIONS.billsPending, SUGGESTIONS.monthSummary],
      });
    }

    const total = items.reduce((sum, item) => sum + item.bill.amount, 0);
    const window = period.assumed ? 'até o fim do mês' : period.label;
    const text = `${capitalize(count(items.length, 'conta', 'contas'))} em aberto ${window}, somando ${money(total)}. A próxima é ${items[0].bill.description} (${money(items[0].bill.amount)}), que ${dueLabel(items[0].days)}.`;

    return ok('bills_due', text, {
      blocks: [
        textBlock(text),
        listBlock(
          items.map((item) => ({
            id: `${item.bill.id}-${item.month}-${item.year}`,
            title: item.bill.description,
            subtitle: dueLabel(item.days),
            category: item.bill.category,
            value: item.bill.amount,
            tone: item.days <= 3 ? 'alerta' : 'neutro',
          }))
        ),
      ],
      data: {
        total,
        items: items.map((item) => ({
          billId: item.bill.id,
          description: item.bill.description,
          amount: item.bill.amount,
          days: item.days,
          month: item.month,
          year: item.year,
        })),
      },
      suggestions: [SUGGESTIONS.billsPending, SUGGESTIONS.leftover, SUGGESTIONS.balance],
    });
  },
};

export const billsPendingTotal = {
  id: 'bills_pending_total',
  priority: 2,
  patterns: [
    /\bquanto (?:ainda )?(?:eu )?(?:tenho|falta|resta)[^.]{0,12}pagar\b/,
    /\bquanto falta (?:de|em) contas?\b/,
    /\btotal (?:das|de) contas?\b/,
    /\bquanto (?:eu )?devo\b/,
  ],
  keywordGroups: [['pagar', 'falta', 'devo', 'aberto', 'pendente', 'pendentes']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const bills = await snapshot.bills();
    if (bills.length === 0) return noData('bills_pending_total', NO_DATA.bills);

    const period = entities.periodOrDefault;
    const month = period.month !== null ? period.month : snapshot.now.getMonth();
    const year = period.year !== null ? period.year : snapshot.now.getFullYear();

    const open = filterBillsByMonth(bills, month, year).filter(
      (bill) => !isBillPaidForMonth(bill, month, year)
    );
    const total = getPendingBillsTotal(bills, month, year);

    if (open.length === 0) {
      return ok('bills_pending_total', `Todas as contas de ${getMonthLabel(month, year)} já estão quitadas.`, {
        data: { total: 0, count: 0 },
        suggestions: [SUGGESTIONS.monthSummary, SUGGESTIONS.balance],
      });
    }

    const text = `Faltam ${count(open.length, 'conta', 'contas')} em ${getMonthLabel(month, year)}, somando ${money(total)}.`;

    return ok('bills_pending_total', text, {
      blocks: [
        textBlock(text),
        valueBlock('Em aberto', total, 'alerta'),
        listBlock(
          open.map((bill) => ({
            id: bill.id,
            title: bill.description,
            subtitle: `dia ${bill.dueDay}`,
            category: bill.category,
            value: bill.amount,
            tone: 'neutro',
          }))
        ),
      ],
      data: { total, count: open.length, month, year },
      suggestions: [SUGGESTIONS.leftover, SUGGESTIONS.billsDue, SUGGESTIONS.balance],
    });
  },
};

export const leftoverAfter = {
  id: 'leftover_after_bills',
  priority: 3,
  patterns: [
    /\bquanto sobra\b/,
    /\bquanto vai sobrar\b/,
    /\bsobra (?:quanto|alguma coisa)\b/,
    /\bdepois de pagar\b/,
    /\bapos (?:pagar|as contas)\b/,
  ],
  keywordGroups: [['sobra', 'sobrar', 'depois de pagar', 'apos pagar', 'resta depois']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const [balance, bills] = await Promise.all([snapshot.balance(), snapshot.bills()]);

    const month = snapshot.now.getMonth();
    const year = snapshot.now.getFullYear();
    // Só contas ainda em aberto: a que já foi quitada virou despesa e já está
    // descontada do saldo — somá-la aqui tiraria o mesmo dinheiro duas vezes.
    const pending = getPendingBillsTotal(bills, month, year);
    const projected = balance.balance - pending;

    const openCount = filterBillsByMonth(bills, month, year).filter(
      (bill) => !isBillPaidForMonth(bill, month, year)
    ).length;

    const text =
      pending === 0
        ? `Não há conta em aberto neste mês, então o saldo de ${money(balance.balance)} está livre.`
        : `Depois de pagar ${count(openCount, 'conta', 'contas')} em aberto (${money(pending)}), sobram ${money(projected)} do seu saldo de ${money(balance.balance)}.`;

    return ok('leftover_after_bills', text, {
      blocks: [
        textBlock(text),
        valueBlock('Sobra projetada', projected, projected >= 0 ? 'positivo' : 'negativo'),
      ],
      data: { ...leftoverAfterBills({ monthIncome: balance.income, monthExpense: balance.expense, pendingBillsAmount: pending }), balance: balance.balance, pending, projected },
      suggestions: [SUGGESTIONS.canSpend, SUGGESTIONS.daily, SUGGESTIONS.billsDue],
    });
  },
};

export const billAmountChanged = {
  id: 'bill_amount_changed',
  priority: 2,
  patterns: [
    /\b(?:alguma )?conta (?:mudou|subiu|aumentou|variou)\b/,
    /\ba conta d[eao] [a-z]+ (?:subiu|aumentou|mudou)\b/,
    /\bmudou de valor\b/,
    /\bveio mais cara\b/,
  ],
  keywordGroups: [['mudou', 'subiu', 'aumentou', 'variou', 'mais cara', 'mais caro']],
  requiredGroups: [0],
  optional: ['bill'],
  run: async (entities, snapshot) => {
    const [bills, transactions] = await Promise.all([snapshot.bills(), snapshot.transactions()]);
    if (bills.length === 0) return noData('bill_amount_changed', NO_DATA.bills);

    const scope = entities.bill ? bills.filter((bill) => bill.id === entities.bill.id) : bills;
    const changes = detectBillAmountChanges(scope, transactions, {});

    if (changes.length === 0) {
      const text = entities.bill
        ? `A conta ${entities.bill.description} não mudou de valor de forma relevante nos últimos meses.`
        : 'Nenhuma conta mudou de valor de forma relevante nos últimos meses.';
      return ok('bill_amount_changed', text, {
        data: { changes: [] },
        suggestions: [SUGGESTIONS.billsDue, SUGGESTIONS.monthSummary],
      });
    }

    const top = changes[0];
    const direction = top.deltaPercent > 0 ? 'subiu' : 'caiu';
    const text = `${capitalize(top.description)} ${direction} ${percent(top.deltaPercent)}: era ${money(top.from)} em ${top.fromMonthKey} e foi ${money(top.to)} em ${top.toMonthKey}.`;

    return ok('bill_amount_changed', text, {
      blocks: [
        textBlock(text),
        listBlock(
          changes.map((item) => ({
            id: item.billId,
            title: item.description,
            subtitle: `${money(item.from)} para ${money(item.to)}`,
            value: item.to - item.from,
            tone: item.deltaPercent > 0 ? 'negativo' : 'positivo',
          }))
        ),
      ],
      data: { changes },
      suggestions: [SUGGESTIONS.billsDue, SUGGESTIONS.budgets],
    });
  },
};

export default [billsDue, billsPendingTotal, leftoverAfter, billAmountChanged];

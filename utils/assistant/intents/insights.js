import { compareMonths, projectMonthEnd, detectBillAmountChanges } from '../../analytics';
import {
  filterBillsByMonth,
  isBillPaidForMonth,
  getBillDueDateFor,
  getPendingBillsTotal,
} from '../../billHelpers';
import { addMonths, daysInMonth, daysUntil, getMonthLabel } from '../../dateHelpers';
import { ok, textBlock, listBlock } from '../result';
import { money, percent, count, capitalize } from '../replies';
import { SUGGESTIONS } from '../suggestions';

const MIN_GROWTH = 0.3;
const MIN_BILL_CHANGE = 0.15;
const DUE_SOON_DAYS = 3;

/**
 * Regras de dica. Cada uma devolve `{ id, severity, text }` ou null; a resposta
 * mostra as mais severas. São regras determinísticas de propósito: uma dica que
 * mudasse de tom a cada abertura minaria a confiança nos números.
 */
export const buildInsights = async (snapshot) => {
  const [transactions, bills] = await Promise.all([snapshot.transactions(), snapshot.bills()]);
  const now = snapshot.now;
  const month = now.getMonth();
  const year = now.getFullYear();

  const insights = [];

  const previous = addMonths(month, year, -1);
  const comparison = compareMonths(transactions, { month, year }, previous);
  const pending = getPendingBillsTotal(bills, month, year);

  // 1. Ritmo de gasto projetado para o fim do mês.
  if (comparison.current.expense > 0) {
    const projection = projectMonthEnd({
      spent: comparison.current.expense,
      day: now.getDate(),
      totalDays: daysInMonth(month, year),
      pendingBills: pending,
    });

    const over = projection.projectedWithBills - comparison.previous.expense;
    if (comparison.previous.expense > 0 && over > 0 && over / comparison.previous.expense >= 0.1) {
      insights.push({
        id: 'pace',
        severity: over / comparison.previous.expense >= 0.3 ? 3 : 2,
        text: `No ritmo atual você fecha ${getMonthLabel(month, year)} em ${money(projection.projectedWithBills)} — ${money(over)} acima de ${getMonthLabel(previous.month, previous.year)}.`,
      });
    }
  }

  // 2. Orçamento no vermelho.
  const statuses = await snapshot.budgetStatus(month, year);
  const exceeded = statuses.filter((item) => item.status === 'exceeded');
  const warning = statuses.filter((item) => item.status === 'warning');

  if (exceeded.length > 0) {
    const worst = exceeded[0];
    insights.push({
      id: 'budget',
      severity: 3,
      text: `Você estourou o orçamento de ${worst.category}: ${money(worst.spent)} de ${money(worst.limit)} (${percent(worst.percent)}).`,
    });
  } else if (warning.length > 0) {
    const tight = warning[0];
    insights.push({
      id: 'budget',
      severity: 2,
      text: `${capitalize(tight.category)} já consumiu ${percent(tight.percent)} do orçamento e ainda faltam dias no mês.`,
    });
  }

  // 3. Contas vencendo (ou vencidas).
  const openBills = filterBillsByMonth(bills, month, year)
    .filter((bill) => !isBillPaidForMonth(bill, month, year))
    .map((bill) => ({ bill, days: daysUntil(getBillDueDateFor(bill, month, year)) }))
    .filter((item) => item.days <= DUE_SOON_DAYS)
    .sort((a, b) => a.days - b.days);

  if (openBills.length > 0) {
    const overdue = openBills.filter((item) => item.days < 0);
    const first = openBills[0];
    insights.push({
      id: 'bills',
      severity: 3,
      text:
        overdue.length > 0
          ? `${capitalize(count(overdue.length, 'conta está vencida', 'contas estão vencidas'))} — a mais antiga é ${overdue[0].bill.description} (${money(overdue[0].bill.amount)}).`
          : `${capitalize(first.bill.description)} vence ${first.days === 0 ? 'hoje' : `em ${count(first.days, 'dia', 'dias')}`} (${money(first.bill.amount)}).`,
    });
  }

  // 4. Categoria que mais cresceu.
  const growing = comparison.categories.filter(
    (item) => item.deltaPercent !== null && item.deltaPercent >= MIN_GROWTH && item.delta > 0
  );
  if (growing.length > 0) {
    const top = growing[0];
    insights.push({
      id: 'growth',
      severity: 2,
      text: `${capitalize(top.name)} subiu ${percent(top.deltaPercent)} em relação ao mês passado: de ${money(top.previous)} para ${money(top.current)}.`,
    });
  }

  // 5. Conta fixa que mudou de valor.
  const changes = detectBillAmountChanges(bills, transactions, { minPercent: MIN_BILL_CHANGE });
  if (changes.length > 0) {
    const change = changes[0];
    insights.push({
      id: 'billChange',
      severity: 2,
      text: `${capitalize(change.description)} ${change.deltaPercent > 0 ? 'subiu' : 'caiu'} ${percent(change.deltaPercent)}: de ${money(change.from)} para ${money(change.to)}.`,
    });
  }

  return insights.sort((a, b) => b.severity - a.severity);
};

export const insights = {
  id: 'insights',
  // Mesma prioridade das consultas: o desempate aqui tem que ser a
  // especificidade do padrao, nao a categoria da intencao.
  priority: 2,
  patterns: [
    /\b(?:me )?d[aá] (?:uma )?dica\b/,
    /\bcomo (?:eu )?(?:estou|to) indo\b/,
    /\btem algo (?:pra|para) (?:eu )?ver\b/,
    /\balgum (?:alerta|aviso|problema)\b/,
    /\bo que (?:eu )?(?:devo|deveria) (?:olhar|saber)\b/,
    /\bdicas?\b/,
  ],
  keywordGroups: [['dica', 'dicas', 'indo', 'alerta', 'aviso', 'conselho', 'devo olhar']],
  requiredGroups: [0],
  run: async (entities, snapshot) => {
    const found = await buildInsights(snapshot);

    if (found.length === 0) {
      const text =
        'Está tudo tranquilo por aqui: nenhum orçamento estourado, nenhuma conta vencendo nos próximos dias e nada fora do padrão nos gastos.';
      return ok('insights', text, {
        data: { insights: [] },
        suggestions: [SUGGESTIONS.monthSummary, SUGGESTIONS.topCategories],
      });
    }

    const top = found.slice(0, 3);
    const text = `Três coisas que valem seu olhar agora:\n\n${top.map((item) => `· ${item.text}`).join('\n')}`;

    return ok('insights', text, {
      blocks: [
        textBlock('Três coisas que valem seu olhar agora:'),
        listBlock(
          top.map((item) => ({
            id: item.id,
            title: item.text,
            tone: item.severity >= 3 ? 'negativo' : 'alerta',
          }))
        ),
      ],
      data: { insights: found },
      suggestions: [SUGGESTIONS.billsDue, SUGGESTIONS.budgets, SUGGESTIONS.topCategories],
    });
  },
};

export default [insights];

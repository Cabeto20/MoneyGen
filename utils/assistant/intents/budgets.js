import { daysInMonth, getMonthLabel } from '../../dateHelpers';
import { ok, noData, textBlock, valueBlock, listBlock } from '../result';
import { money, percent, count, listNames, NO_DATA, capitalize } from '../replies';
import { SUGGESTIONS } from '../suggestions';

const scopeMonth = (period, now) => ({
  month: period.month !== null ? period.month : now.getMonth(),
  year: period.year !== null ? period.year : now.getFullYear(),
});

export const budgetExceeded = {
  id: 'budget_exceeded',
  priority: 2,
  patterns: [
    /\bestourei\b/,
    /\bestourou\b/,
    /\b(?:passei|passou) do limite\b/,
    /\bno vermelho\b/,
    /\b(?:meus? )?or[cç]amentos?\b/,
    /\bdentro do (?:limite|or[cç]amento)\b/,
  ],
  keywordGroups: [['estourei', 'estourou', 'limite', 'orcamento', 'orcamentos', 'vermelho']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const { month, year } = scopeMonth(entities.periodOrDefault, snapshot.now);
    const statuses = await snapshot.budgetStatus(month, year);

    if (statuses.length === 0) return noData('budget_exceeded', NO_DATA.budgets);

    const exceeded = statuses.filter((item) => item.status === 'exceeded');
    const warning = statuses.filter((item) => item.status === 'warning');

    let text;
    if (exceeded.length > 0) {
      const worst = exceeded[0];
      text = `Você estourou ${count(exceeded.length, 'orçamento', 'orçamentos')} em ${getMonthLabel(month, year)}: ${listNames(exceeded.map((item) => item.category))}. O pior é ${worst.category}, com ${money(worst.spent)} de ${money(worst.limit)} (${percent(worst.percent)}).`;
      if (warning.length > 0) {
        text += ` Perto do limite: ${listNames(warning.map((item) => item.category))}.`;
      }
    } else if (warning.length > 0) {
      const tight = warning[0];
      text = `Nenhum orçamento estourado, mas ${listNames(warning.map((item) => item.category))} ${warning.length === 1 ? 'está' : 'estão'} perto do limite — ${tight.category} já usou ${percent(tight.percent)}.`;
    } else {
      const tightest = statuses[0];
      text = `Todos os orçamentos de ${getMonthLabel(month, year)} estão sob controle. O mais apertado é ${tightest.category}, com ${percent(tightest.percent)} do limite.`;
    }

    return ok('budget_exceeded', text, {
      blocks: [
        textBlock(text),
        listBlock(
          statuses.map((item) => ({
            id: item.category,
            title: item.category,
            subtitle: `${money(item.spent)} de ${money(item.limit)} · ${percent(item.percent)}`,
            category: item.category,
            value: item.remaining,
            tone: item.status === 'exceeded' ? 'negativo' : item.status === 'warning' ? 'alerta' : 'positivo',
          }))
        ),
      ],
      data: { month, year, statuses, exceeded, warning },
      suggestions: [SUGGESTIONS.topCategories, SUGGESTIONS.compare, SUGGESTIONS.monthExpense],
    });
  },
};

export const budgetRemaining = {
  id: 'budget_remaining',
  priority: 2,
  patterns: [
    /\bquanto (?:ainda )?(?:eu )?posso gastar (?:com|de|em)\b/,
    /\bquanto (?:ainda )?(?:me )?resta (?:de|com|em)\b/,
    /\bquanto (?:sobrou|falta) (?:do|no) (?:or[cç]amento|limite)\b/,
  ],
  keywordGroups: [['posso gastar', 'resta', 'sobrou', 'falta', 'limite', 'orcamento']],
  requiredGroups: [0],
  requires: ['category'],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const { month, year } = scopeMonth(entities.periodOrDefault, snapshot.now);
    const statuses = await snapshot.budgetStatus(month, year);
    const target = entities.category.value;
    const found = statuses.find((item) => item.category === target);

    if (!found) {
      return noData('budget_remaining', `Você não tem orçamento definido para ${target}.`, {
        suggestions: [SUGGESTIONS.budgets, SUGGESTIONS.topCategories],
      });
    }

    if (found.remaining <= 0) {
      const text = `Em ${found.category} você já passou do limite: gastou ${money(found.spent)} de ${money(found.limit)}, ${money(Math.abs(found.remaining))} acima.`;
      return ok('budget_remaining', text, {
        blocks: [textBlock(text), valueBlock(`${found.category} — excedente`, found.remaining, 'negativo')],
        data: { ...found, month, year },
        suggestions: [SUGGESTIONS.budgets, SUGGESTIONS.topCategories],
      });
    }

    const isCurrentMonth = month === snapshot.now.getMonth() && year === snapshot.now.getFullYear();
    const daysLeft = isCurrentMonth
      ? Math.max(1, daysInMonth(month, year) - snapshot.now.getDate() + 1)
      : null;

    const pace = daysLeft ? ` Faltam ${count(daysLeft, 'dia', 'dias')} no mês, o que dá ${money(found.remaining / daysLeft)} por dia.` : '';
    const text = `Em ${found.category} restam ${money(found.remaining)} de ${money(found.limit)} — você já usou ${percent(found.percent)}.${pace}`;

    return ok('budget_remaining', text, {
      blocks: [textBlock(text), valueBlock(`${found.category} — disponível`, found.remaining, 'positivo')],
      data: { ...found, month, year, daysLeft },
      suggestions: [SUGGESTIONS.budgets, SUGGESTIONS.daily, SUGGESTIONS.canSpend],
    });
  },
};

export default [budgetExceeded, budgetRemaining];

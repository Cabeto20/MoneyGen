import { compareMonths } from '../../analytics';
import { addMonths, getMonthLabel } from '../../dateHelpers';
import { ok, noData, textBlock, valueBlock, listBlock } from '../result';
import { money, changePhrase, percent, capitalize } from '../replies';
import { SUGGESTIONS } from '../suggestions';

/**
 * Mês de referência da comparação. Semana e dia não têm mês anterior óbvio,
 * então caem no mês corrente — comparar "essa semana" com "a semana passada"
 * seria outra pergunta.
 */
const referenceMonth = (period, now) => ({
  month: period.month !== null ? period.month : now.getMonth(),
  year: period.year !== null ? period.year : now.getFullYear(),
});

export const comparePeriods = {
  id: 'compare_periods',
  priority: 2,
  patterns: [
    /\bgastei mais\b/,
    /\bgastei menos\b/,
    /\bgastando mais\b/,
    /\b(?:mais|menos) que (?:o )?mes passado\b/,
    /\bcompara(?:r|cao)?\b/,
    /\bem rela[cç]ao ao mes\b/,
  ],
  keywordGroups: [['mais', 'menos', 'compar', 'aumentou', 'diminuiu', 'piorou', 'melhorou']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const current = referenceMonth(entities.periodOrDefault, snapshot.now);
    const previous = addMonths(current.month, current.year, -1);
    const transactions = await snapshot.transactions();
    const comparison = compareMonths(transactions, current, previous);

    if (comparison.current.expense === 0 && comparison.previous.expense === 0) {
      return noData('compare_periods', 'Não tenho gasto registrado nos dois meses para comparar.');
    }

    const currentLabel = getMonthLabel(current.month, current.year);
    const previousLabel = getMonthLabel(previous.month, previous.year);

    const heavier = comparison.categories.find((item) => item.delta > 0);
    const parts = [
      `Em ${currentLabel} você gastou ${money(comparison.current.expense)}, contra ${money(comparison.previous.expense)} em ${previousLabel} — ${changePhrase(comparison.deltaPercent)}.`,
    ];
    if (heavier) {
      parts.push(`O que mais pesou foi ${heavier.name} (+${money(heavier.delta)}).`);
    }

    const text = parts.join(' ');

    return ok('compare_periods', text, {
      blocks: [
        textBlock(text),
        valueBlock('Diferença', comparison.deltaAbsolute, comparison.deltaAbsolute > 0 ? 'negativo' : 'positivo'),
      ],
      data: { current, previous, comparison },
      suggestions: [SUGGESTIONS.topCategories, SUGGESTIONS.average, SUGGESTIONS.budgets],
    });
  },
};

export const fastestGrowingCategory = {
  id: 'fastest_growing_category',
  priority: 2,
  patterns: [
    /\bo que (?:mais )?(?:aumentou|subiu|cresceu)\b/,
    /\bonde (?:eu )?piorei\b/,
    /\bqual categoria (?:mais )?(?:aumentou|subiu|cresceu)\b/,
    /\bo que (?:esta|ta) (?:pesando|subindo)\b/,
  ],
  keywordGroups: [['aumentou', 'subiu', 'cresceu', 'piorei', 'pesando', 'subindo']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const current = referenceMonth(entities.periodOrDefault, snapshot.now);
    const previous = addMonths(current.month, current.year, -1);
    const transactions = await snapshot.transactions();
    const comparison = compareMonths(transactions, current, previous);

    const growing = comparison.categories.filter((item) => item.delta > 0);
    if (growing.length === 0) {
      return ok('fastest_growing_category', 'Nenhuma categoria subiu em relação ao mês anterior — está tudo estável ou em queda.', {
        data: { comparison },
        suggestions: [SUGGESTIONS.topCategories, SUGGESTIONS.compare],
      });
    }

    const top = growing[0];
    const variation =
      top.deltaPercent === null
        ? 'apareceu agora (não havia gasto nessa categoria no mês anterior)'
        : `subiu ${percent(top.deltaPercent)}`;

    const text = `${capitalize(top.name)} ${variation}: de ${money(top.previous)} para ${money(top.current)}, ${money(top.delta)} a mais.`;

    return ok('fastest_growing_category', text, {
      blocks: [
        textBlock(text),
        listBlock(
          growing.map((item) => ({
            id: item.name,
            title: item.name,
            subtitle: `${money(item.previous)} para ${money(item.current)}`,
            category: item.name,
            value: item.delta,
            tone: 'negativo',
          }))
        ),
      ],
      data: { comparison, top },
      suggestions: [SUGGESTIONS.budgets, SUGGESTIONS.topCategories],
    });
  },
};

export const monthlyAverage = {
  id: 'monthly_average',
  priority: 2,
  patterns: [
    /\b(?:em )?media\b/,
    /\bquanto (?:eu )?gasto por mes\b/,
    /\bmedia (?:de )?(?:gasto|gastos|mensal)\b/,
  ],
  keywordGroups: [['media', 'por mes', 'mensal']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const period = entities.periodOrDefault;
    // Sem recorte explícito, seis meses é a janela que o app já usa nos
    // relatórios — manter igual evita dois números para a mesma pergunta.
    const window = period.kind === 'lastMonths' ? period.months.length : 6;
    const transactions = await snapshot.transactions();

    const months = [];
    for (let i = window - 1; i >= 0; i -= 1) {
      const { month, year } = addMonths(snapshot.now.getMonth(), snapshot.now.getFullYear(), -i);
      const totals = compareMonths(transactions, { month, year }, { month, year });
      months.push({ month, year, expense: totals.current.expense, income: totals.current.income });
    }

    const active = months.filter((item) => item.expense > 0);
    if (active.length === 0) {
      return noData('monthly_average', 'Ainda não tenho meses com gasto suficiente para tirar uma média.');
    }

    const total = active.reduce((sum, item) => sum + item.expense, 0);
    const average = total / active.length;
    const min = active.reduce((a, b) => (a.expense < b.expense ? a : b));
    const max = active.reduce((a, b) => (a.expense > b.expense ? a : b));

    const text = `Nos últimos ${active.length} meses com movimento você gastou ${money(average)} por mês em média. O mais leve foi ${getMonthLabel(min.month, min.year)} (${money(min.expense)}) e o mais pesado, ${getMonthLabel(max.month, max.year)} (${money(max.expense)}).`;

    return ok('monthly_average', text, {
      blocks: [textBlock(text), valueBlock('Média mensal', average, 'neutro')],
      data: { months, average, min, max },
      suggestions: [SUGGESTIONS.compare, SUGGESTIONS.topCategories],
    });
  },
};

export default [comparePeriods, fastestGrowingCategory, monthlyAverage];

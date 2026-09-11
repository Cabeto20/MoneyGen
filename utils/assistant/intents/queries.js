import { summarizeRange, expensesByCategoryInRange } from '../../analytics';
import { getPendingBillsTotal } from '../../billHelpers';
import { isFuturePeriod, periodPhrase } from '../entities/period';
import { ok, noData, valueBlock, textBlock, listBlock } from '../result';
import { money, count, NO_DATA, capitalize } from '../replies';
import { SUGGESTIONS } from '../suggestions';

/** Soma do período em qualquer recorte — mês, semana, dia ou intervalo. */
const summarizeFor = async (snapshot, period) => {
  const transactions = await snapshot.transactions();
  return summarizeRange(transactions, period.start, period.end);
};

/** Oferece o ano alternativo quando o mês nomeado caiu no ano de trás. */
const alternateYearSuggestion = (period) =>
  period.alternateYear
    ? [{
        id: 'alternateYear',
        label: `E em ${period.label.split(' de ')[0]} de ${period.alternateYear}?`,
        text: `quanto gastei em ${period.label.split(' de ')[0]} de ${period.alternateYear}`,
      }]
    : [];

export const balanceNow = {
  id: 'balance_now',
  priority: 2,
  patterns: [
    /\bquanto (?:eu )?tenho\b/,
    /\btenho quanto\b/,
    /\b(?:qual|quanto e) (?:o )?(?:meu )?saldo\b/,
    /\bsaldo (?:atual|total|geral)\b/,
    /\bmeu saldo\b/,
  ],
  keywordGroups: [['tenho', 'saldo', 'disponivel', 'sobrou no total']],
  requiredGroups: [0],
  optional: [],
  run: async (entities, snapshot) => {
    const balance = await snapshot.balance();
    const text = `Seu saldo é ${money(balance.balance)}. No total entraram ${money(balance.income)} e saíram ${money(balance.expense)}.`;

    return ok('balance_now', text, {
      blocks: [
        textBlock(text),
        valueBlock('Saldo geral', balance.balance, balance.balance >= 0 ? 'positivo' : 'negativo'),
      ],
      data: balance,
      suggestions: [SUGGESTIONS.monthSummary, SUGGESTIONS.leftover, SUGGESTIONS.billsDue],
    });
  },
};

export const walletBalance = {
  id: 'wallet_balance',
  priority: 2,
  patterns: [
    /\bquanto (?:tem|tenho|sobrou|resta)\b/,
    /\bsaldo d[ao]\b/,
    /\bcarteira\b/,
  ],
  keywordGroups: [['quanto', 'saldo', 'carteira']],
  requiredGroups: [0],
  requires: ['account'],
  run: async (entities, snapshot) => {
    const balances = await snapshot.accountBalances();
    const wallet = balances.find((item) => item.id === entities.account.id);

    if (!wallet) {
      return noData('wallet_balance', `Não encontrei a carteira ${entities.account.name}.`);
    }

    const text = `Na carteira ${wallet.name} você tem ${money(wallet.balance)}, somando ${count(wallet.transactionCount, 'lançamento', 'lançamentos')}.`;

    return ok('wallet_balance', text, {
      blocks: [
        textBlock(text),
        valueBlock(wallet.name, wallet.balance, wallet.balance >= 0 ? 'positivo' : 'negativo'),
      ],
      data: wallet,
      suggestions: [SUGGESTIONS.balance, SUGGESTIONS.monthSummary],
    });
  },
};

export const expensePeriod = {
  id: 'expense_period',
  priority: 2,
  patterns: [
    /\bquanto (?:eu )?(?:gastei|gasto|torrei|saiu)\b/,
    /\b(?:gastei|gasto) quanto\b/,
    /\btotal de (?:gastos|despesas)\b/,
    /\bmeus gastos\b/,
  ],
  keywordGroups: [['gastei', 'gasto', 'gastos', 'despesa', 'despesas', 'torrei', 'saiu']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const period = entities.periodOrDefault;

    if (isFuturePeriod(period, snapshot.now)) {
      return noData('expense_period', NO_DATA.future(periodPhrase(period)), {
        suggestions: [SUGGESTIONS.monthExpense, ...alternateYearSuggestion(period)],
      });
    }

    const summary = await summarizeFor(snapshot, period);

    if (summary.count === 0) {
      return noData('expense_period', NO_DATA.transactions(periodPhrase(period)), {
        data: { period, ...summary },
        suggestions: [SUGGESTIONS.monthExpense, ...alternateYearSuggestion(period)],
      });
    }

    const text = `Você gastou ${money(summary.expense)} ${periodPhrase(period)}, em ${count(summary.count, 'lançamento', 'lançamentos')}.`;

    return ok('expense_period', text, {
      blocks: [textBlock(text), valueBlock(`Gasto ${periodPhrase(period)}`, summary.expense, 'negativo')],
      data: { period, ...summary },
      suggestions: [SUGGESTIONS.topCategories, SUGGESTIONS.compare, SUGGESTIONS.lastMonth],
    });
  },
};

export const incomePeriod = {
  id: 'income_period',
  priority: 2,
  patterns: [
    /\bquanto (?:eu )?(?:recebi|recebo|ganhei|entrou)\b/,
    /\b(?:recebi|entrou) quanto\b/,
    /\btotal de (?:receitas|entradas)\b/,
    /\bminhas receitas\b/,
  ],
  keywordGroups: [['recebi', 'recebo', 'receita', 'receitas', 'entrou', 'entrada', 'entradas', 'ganhei']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const period = entities.periodOrDefault;

    if (isFuturePeriod(period, snapshot.now)) {
      return noData('income_period', NO_DATA.future(periodPhrase(period)));
    }

    const summary = await summarizeFor(snapshot, period);

    if (summary.income === 0) {
      return noData('income_period', `Não encontrei nenhuma entrada ${periodPhrase(period)}.`, {
        data: { period, ...summary },
      });
    }

    const text = `Entraram ${money(summary.income)} ${periodPhrase(period)}.`;

    return ok('income_period', text, {
      blocks: [textBlock(text), valueBlock(`Entradas ${periodPhrase(period)}`, summary.income, 'positivo')],
      data: { period, ...summary },
      suggestions: [SUGGESTIONS.monthSummary, SUGGESTIONS.monthExpense],
    });
  },
};

export const periodSummary = {
  id: 'period_summary',
  priority: 2,
  patterns: [
    /\bcomo (?:eu )?estou\b/,
    // Sem exigir "mes" depois: o período já foi consumido da frase, então
    // "como foi agosto" chega aqui como "como foi".
    /\bcomo (?:foi|esta|vai)\b/,
    /\bresumo\b/,
    /\bpanorama\b/,
    /\bbalanco\b/,
  ],
  keywordGroups: [['resumo', 'panorama', 'balanco', 'como estou', 'situacao', 'como foi', 'como esta']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const period = entities.periodOrDefault;
    const [summary, transactions, bills] = await Promise.all([
      summarizeFor(snapshot, period),
      snapshot.transactions(),
      snapshot.bills(),
    ]);

    if (summary.count === 0) {
      return noData('period_summary', NO_DATA.transactions(periodPhrase(period)));
    }

    // Pendência só faz sentido em recorte de mês; semana e dia não têm
    // competência de conta a pagar.
    const month = period.month !== null ? period.month : snapshot.now.getMonth();
    const year = period.year !== null ? period.year : snapshot.now.getFullYear();
    const pendingAmount = getPendingBillsTotal(bills, month, year);

    const categories = expensesByCategoryInRange(transactions, period.start, period.end);
    const top = categories[0];

    const parts = [
      `${capitalize(periodPhrase(period))}: entradas ${money(summary.income)}, saídas ${money(summary.expense)}, saldo ${money(summary.balance)}.`,
    ];
    if (pendingAmount > 0) parts.push(`Ainda faltam ${money(pendingAmount)} em contas.`);
    if (top) parts.push(`Maior gasto: ${top.name} (${money(top.total)}).`);

    const text = parts.join(' ');

    return ok('period_summary', text, {
      blocks: [
        textBlock(text),
        valueBlock('Saldo do período', summary.balance, summary.balance >= 0 ? 'positivo' : 'negativo'),
      ],
      data: { period, ...summary, pendingAmount, categories },
      suggestions: [SUGGESTIONS.topCategories, SUGGESTIONS.billsDue, SUGGESTIONS.leftover],
    });
  },
};

export const categoryExpense = {
  id: 'category_expense',
  priority: 2,
  // Exige a marca de pergunta. Sem isso "gastei no mercado" — que é uma
  // afirmação, alguém querendo lançar — seria lido como consulta.
  patterns: [
    /\bquanto (?:eu )?(?:gastei|gasto|foi|deu) (?:com|de|em|no|na)\b/,
    /\bquanto (?:foi|deu) (?:de|com)\b/,
    /\b(?:gastos|despesas) (?:com|de|em) [a-z]/,
  ],
  keywordGroups: [['gastei', 'gasto', 'gastos', 'despesa', 'despesas', 'foi de', 'deu de']],
  requiredGroups: [0],
  requires: ['category'],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const period = entities.periodOrDefault;
    const target = entities.category.value;
    const transactions = await snapshot.transactions();
    const categories = expensesByCategoryInRange(transactions, period.start, period.end);
    const found = categories.find((item) => item.name === target);

    if (!found) {
      const text = `Não encontrei gasto em ${target} ${periodPhrase(period)}.`;
      return noData('category_expense', text, {
        data: { period, category: target },
        suggestions: [SUGGESTIONS.topCategories, SUGGESTIONS.monthExpense],
      });
    }

    const total = categories.reduce((sum, item) => sum + item.total, 0);
    const share = total > 0 ? found.total / total : 0;
    const text = `Com ${found.name} você gastou ${money(found.total)} ${periodPhrase(period)}, em ${count(found.count, 'compra', 'compras')} — ${Math.round(share * 100)}% do total do período.`;

    return ok('category_expense', text, {
      blocks: [textBlock(text), valueBlock(found.name, found.total, 'negativo')],
      data: { period, ...found, share },
      suggestions: [SUGGESTIONS.topCategories, SUGGESTIONS.budgets, SUGGESTIONS.compare],
    });
  },
};

export const topCategories = {
  id: 'top_categories',
  priority: 2,
  patterns: [
    /\b(?:com o que|no que|onde) (?:eu )?(?:mais )?(?:gasto|gastei|gasta)\b/,
    /\bonde vai (?:o )?(?:meu )?dinheiro\b/,
    /\bmaiores (?:gastos|despesas)\b/,
    /\bprincipais (?:gastos|despesas)\b/,
    /\bcategorias?\b/,
  ],
  keywordGroups: [['mais gast', 'onde', 'maiores', 'principais', 'categoria', 'categorias', 'ranking']],
  requiredGroups: [0],
  optional: ['period'],
  run: async (entities, snapshot) => {
    const period = entities.periodOrDefault;
    const transactions = await snapshot.transactions();
    const categories = expensesByCategoryInRange(transactions, period.start, period.end);

    if (categories.length === 0) {
      return noData('top_categories', NO_DATA.transactions(periodPhrase(period)));
    }

    const total = categories.reduce((sum, item) => sum + item.total, 0);
    const top = categories.slice(0, 3);
    const ranking = top
      .map((item, index) => `${index + 1}) ${item.name} ${money(item.total)}`)
      .join(' · ');

    const topShare = total > 0 ? top.reduce((sum, item) => sum + item.total, 0) / total : 0;
    const text = `Onde seu dinheiro mais foi ${periodPhrase(period)}: ${ranking}. Essas três somam ${Math.round(topShare * 100)}% de ${money(total)}.`;

    return ok('top_categories', text, {
      blocks: [
        textBlock(text),
        listBlock(
          categories.map((item) => ({
            id: item.name,
            title: item.name,
            subtitle: count(item.count, 'lançamento', 'lançamentos'),
            category: item.name,
            value: item.total,
            tone: 'negativo',
          }))
        ),
      ],
      data: { period, categories, total },
      suggestions: [SUGGESTIONS.compare, SUGGESTIONS.budgets, SUGGESTIONS.monthExpense],
    });
  },
};

export default [
  balanceNow,
  walletBalance,
  expensePeriod,
  incomePeriod,
  periodSummary,
  categoryExpense,
  topCategories,
];

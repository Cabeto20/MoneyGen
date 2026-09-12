/**
 * Catálogo de sugestões clicáveis.
 *
 * Num motor de regras o usuário não tem como adivinhar o que o assistente
 * entende. Os chips são a descoberta — e o `text` de cada um é reinjetado como
 * se tivesse sido digitado, para existir um caminho de execução só.
 */

/**
 * O `intentId` de cada chip é o que o texto dele aciona. Fica declarado, e não
 * deduzido, para a ordenação por uso (camada 1) não ter que resolver a frase
 * toda vez — e o `check-assistant` cobra a declaração contra o motor de
 * verdade, então um chip que passe a acionar outra intenção aparece lá.
 */
export const SUGGESTIONS = {
  balance: { id: 'balance', label: 'Meu saldo', text: 'quanto tenho?', intentId: 'balance_now' },
  monthSummary: { id: 'monthSummary', label: 'Resumo do mês', text: 'como estou esse mês?', intentId: 'period_summary' },
  monthExpense: { id: 'monthExpense', label: 'Gasto do mês', text: 'quanto gastei esse mês?', intentId: 'expense_period' },
  lastMonth: { id: 'lastMonth', label: 'E mês passado?', text: 'quanto gastei mês passado?', intentId: 'expense_period' },
  topCategories: { id: 'topCategories', label: 'Onde mais gasto', text: 'com o que eu mais gasto?', intentId: 'top_categories' },
  compare: { id: 'compare', label: 'Comparar meses', text: 'gastei mais que mês passado?', intentId: 'compare_periods' },
  average: { id: 'average', label: 'Média mensal', text: 'quanto gasto por mês em média?', intentId: 'monthly_average' },
  billsDue: { id: 'billsDue', label: 'Contas a vencer', text: 'o que vence essa semana?', intentId: 'bills_due' },
  billsPending: { id: 'billsPending', label: 'Falta pagar', text: 'quanto ainda tenho que pagar esse mês?', intentId: 'bills_pending_total' },
  leftover: { id: 'leftover', label: 'Quanto sobra', text: 'quanto sobra depois de pagar as contas?', intentId: 'leftover_after_bills' },
  billChanged: { id: 'billChanged', label: 'Conta que subiu', text: 'alguma conta mudou de valor?', intentId: 'bill_amount_changed' },
  budgets: { id: 'budgets', label: 'Meus orçamentos', text: 'estourei algum orçamento?', intentId: 'budget_exceeded' },
  goals: { id: 'goals', label: 'Minhas metas', text: 'como estão minhas metas?', intentId: 'goal_progress' },
  canSpend: { id: 'canSpend', label: 'Posso gastar?', text: 'posso gastar 500 esse mês?', intentId: 'can_i_spend' },
  daily: { id: 'daily', label: 'Teto por dia', text: 'quanto posso gastar por dia até o fim do mês?', intentId: 'daily_allowance' },
  installments: { id: 'installments', label: 'Simular parcelas', text: 'se eu parcelar 1200 em 6x como fica?', intentId: 'simulate_installments' },
  insights: { id: 'insights', label: 'Me dá uma dica', text: 'me dá uma dica', intentId: 'insights' },
  help: { id: 'help', label: 'O que você faz?', text: 'o que você sabe fazer?', intentId: 'help' },
};

/** Menu de capacidades: o que aparece no fallback e no estado vazio. */
export const CAPABILITY_GROUPS = [
  {
    title: 'Saldo e gastos',
    items: [SUGGESTIONS.balance, SUGGESTIONS.monthSummary, SUGGESTIONS.topCategories],
  },
  {
    title: 'Contas a pagar',
    items: [SUGGESTIONS.billsDue, SUGGESTIONS.billsPending, SUGGESTIONS.leftover],
  },
  {
    title: 'Comparar e planejar',
    items: [SUGGESTIONS.compare, SUGGESTIONS.average, SUGGESTIONS.budgets, SUGGESTIONS.goals],
  },
  {
    title: 'Simular',
    items: [SUGGESTIONS.canSpend, SUGGESTIONS.daily, SUGGESTIONS.installments],
  },
];

let intentUses = {};

/**
 * Quantas vezes cada intenção já foi acionada por este usuário (camada 1).
 *
 * Chega pronto de `memory/` pelo mesmo motivo do índice semântico: este módulo
 * é importado pelo motor inteiro e não pode conhecer AsyncStorage.
 */
export const setIntentUsage = (uses) => {
  intentUses = uses && typeof uses === 'object' ? uses : {};
};

/**
 * Põe na frente o que este usuário mais pergunta.
 *
 * A ordenação é estável e só desempata pelo uso: sem histórico, a lista sai
 * exatamente na ordem escrita à mão. É o que impede o cardápio de embaralhar
 * sozinho num aparelho recém-instalado, onde todo mundo tem contagem zero.
 */
export const byUsage = (items) =>
  items
    .map((item, order) => ({ item, order }))
    .sort(
      (a, b) =>
        (intentUses[b.item.intentId] || 0) - (intentUses[a.item.intentId] || 0) ||
        a.order - b.order
    )
    .map((entry) => entry.item);

/** Cardápio de capacidades já na ordem deste usuário. */
export const orderedCapabilityGroups = () =>
  CAPABILITY_GROUPS.map((group) => ({ ...group, items: byUsage(group.items) }));

export const DEFAULT_SUGGESTIONS = [
  SUGGESTIONS.monthSummary,
  SUGGESTIONS.topCategories,
  SUGGESTIONS.billsDue,
  SUGGESTIONS.insights,
];

/**
 * Sugestões do fallback. Quando alguma entidade foi reconhecida, prioriza o
 * que combina com ela: quem falou de período provavelmente quer uma pergunta
 * que use período, e ver isso escrito ensina a formular a próxima.
 */
const baseFallbackSuggestions = (present = []) => {
  if (present.includes('category')) {
    return [SUGGESTIONS.topCategories, SUGGESTIONS.monthExpense, SUGGESTIONS.budgets, SUGGESTIONS.help];
  }
  if (present.includes('goal')) {
    return [SUGGESTIONS.goals, SUGGESTIONS.monthSummary, SUGGESTIONS.help];
  }
  if (present.includes('bill')) {
    return [SUGGESTIONS.billsDue, SUGGESTIONS.billsPending, SUGGESTIONS.billChanged, SUGGESTIONS.help];
  }
  if (present.includes('amount')) {
    return [SUGGESTIONS.canSpend, SUGGESTIONS.installments, SUGGESTIONS.daily, SUGGESTIONS.help];
  }
  if (present.includes('period')) {
    return [SUGGESTIONS.monthExpense, SUGGESTIONS.monthSummary, SUGGESTIONS.topCategories, SUGGESTIONS.billsDue];
  }
  return DEFAULT_SUGGESTIONS;
};

export const fallbackSuggestions = (present = []) => byUsage(baseFallbackSuggestions(present));

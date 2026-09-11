/**
 * Catálogo de sugestões clicáveis.
 *
 * Num motor de regras o usuário não tem como adivinhar o que o assistente
 * entende. Os chips são a descoberta — e o `text` de cada um é reinjetado como
 * se tivesse sido digitado, para existir um caminho de execução só.
 */

export const SUGGESTIONS = {
  balance: { id: 'balance', label: 'Meu saldo', text: 'quanto tenho?' },
  monthSummary: { id: 'monthSummary', label: 'Resumo do mês', text: 'como estou esse mês?' },
  monthExpense: { id: 'monthExpense', label: 'Gasto do mês', text: 'quanto gastei esse mês?' },
  lastMonth: { id: 'lastMonth', label: 'E mês passado?', text: 'quanto gastei mês passado?' },
  topCategories: { id: 'topCategories', label: 'Onde mais gasto', text: 'com o que eu mais gasto?' },
  compare: { id: 'compare', label: 'Comparar meses', text: 'gastei mais que mês passado?' },
  average: { id: 'average', label: 'Média mensal', text: 'quanto gasto por mês em média?' },
  billsDue: { id: 'billsDue', label: 'Contas a vencer', text: 'o que vence essa semana?' },
  billsPending: { id: 'billsPending', label: 'Falta pagar', text: 'quanto ainda tenho que pagar esse mês?' },
  leftover: { id: 'leftover', label: 'Quanto sobra', text: 'quanto sobra depois de pagar as contas?' },
  billChanged: { id: 'billChanged', label: 'Conta que subiu', text: 'alguma conta mudou de valor?' },
  budgets: { id: 'budgets', label: 'Meus orçamentos', text: 'estourei algum orçamento?' },
  goals: { id: 'goals', label: 'Minhas metas', text: 'como estão minhas metas?' },
  canSpend: { id: 'canSpend', label: 'Posso gastar?', text: 'posso gastar 500 esse mês?' },
  daily: { id: 'daily', label: 'Teto por dia', text: 'quanto posso gastar por dia até o fim do mês?' },
  installments: { id: 'installments', label: 'Simular parcelas', text: 'se eu parcelar 1200 em 6x como fica?' },
  insights: { id: 'insights', label: 'Me dá uma dica', text: 'me dá uma dica' },
  help: { id: 'help', label: 'O que você faz?', text: 'o que você sabe fazer?' },
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
export const fallbackSuggestions = (present = []) => {
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

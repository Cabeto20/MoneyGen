import {
  getTransactions,
  getBills,
  getAccounts,
  getGoals,
  getBalance,
  getBudgetStatus,
  getAccountBalances,
} from '../../database/database';

/**
 * Cache de leitura por turno.
 *
 * Cada getter do database relê e faz JSON.parse da coleção inteira. Uma única
 * pergunta pode precisar de transações, contas, carteiras e orçamentos — sem
 * este cache, a mesma coleção seria parseada quatro vezes numa base que pode
 * ter milhares de lançamentos.
 *
 * O snapshot vale por um turno e é descartado no fim: um cache global ficaria
 * velho assim que o próprio chat gravasse um lançamento.
 */
export const createSnapshot = (now = new Date()) => {
  const cache = new Map();

  // Guarda a Promise, não o valor: duas chamadas simultâneas compartilham a
  // mesma leitura em vez de disparar duas.
  const once = (key, load) => {
    if (!cache.has(key)) cache.set(key, load());
    return cache.get(key);
  };

  return {
    now,
    transactions: () => once('transactions', getTransactions),
    bills: () => once('bills', getBills),
    accounts: () => once('accounts', getAccounts),
    goals: () => once('goals', getGoals),
    accountBalances: () => once('accountBalances', getAccountBalances),
    balance: (accountId = null) => once(`balance:${accountId}`, () => getBalance(accountId)),
    budgetStatus: (month, year) =>
      once(`budget:${month}-${year}`, () => getBudgetStatus(month, year)),
  };
};

/**
 * Listas que a extração de entidades precisa para reconhecer nomes próprios
 * (carteira, meta, conta a pagar) antes de qualquer intenção rodar.
 */
export const loadRefs = async (snapshot) => {
  const [accounts, goals, bills] = await Promise.all([
    snapshot.accounts(),
    snapshot.goals(),
    snapshot.bills(),
  ]);
  return { accounts, goals, bills };
};

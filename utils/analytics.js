import { getTransactionDate, isSameMonth, monthKey } from './dateHelpers';

/**
 * Agregações puras sobre arrays já carregados. Ficam fora de `database.js` de
 * propósito: as telas passam o que já têm em estado e o assistente passa o
 * snapshot, sem ninguém reler o AsyncStorage só para fazer uma soma.
 */

const inRange = (transaction, start, end) => {
  const date = getTransactionDate(transaction);
  return !!date && date >= start && date <= end;
};

/** Mesmo recorte de `getPeriodSummary`, mas puro e para qualquer intervalo. */
export const summarizeRange = (transactions, start, end) => {
  let income = 0;
  let expense = 0;
  let count = 0;

  transactions.forEach((transaction) => {
    if (!inRange(transaction, start, end)) return;
    count += 1;
    if (transaction.type === 'income') income += transaction.amount;
    else expense += transaction.amount;
  });

  return { income, expense, balance: income - expense, count };
};

/**
 * `getTransactionsByCategory` só aceita mês/ano ou o histórico inteiro. Esta
 * versão aceita intervalo — é o que uma pergunta como "quanto gastei com
 * mercado essa semana" precisa. Mesmo shape de retorno.
 */
export const expensesByCategoryInRange = (transactions, start, end) => {
  const categories = {};

  transactions.forEach((transaction) => {
    if (transaction.type !== 'expense') return;
    if (!inRange(transaction, start, end)) return;

    // Categoria vazia vira 'Outros', igual às demais agregações do app.
    const name = transaction.category || 'Outros';
    if (!categories[name]) categories[name] = { total: 0, count: 0 };
    categories[name].total += transaction.amount;
    categories[name].count += 1;
  });

  return Object.entries(categories)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);
};

const monthTotals = (transactions, month, year) => {
  let income = 0;
  let expense = 0;
  const categories = {};

  transactions.forEach((transaction) => {
    if (!isSameMonth(getTransactionDate(transaction), month, year)) return;

    if (transaction.type === 'income') {
      income += transaction.amount;
      return;
    }

    expense += transaction.amount;
    const name = transaction.category || 'Outros';
    categories[name] = (categories[name] || 0) + transaction.amount;
  });

  return { income, expense, categories };
};

/**
 * Percentual de variação. Devolve null quando a base é zero — dividir por zero
 * daria Infinity e a resposta sairia com "+Infinity%".
 */
const percentChange = (current, previous) =>
  previous === 0 ? null : (current - previous) / previous;

/**
 * Comparação entre dois meses, no total e por categoria. Alimenta tanto
 * "gastei mais que mês passado?" quanto "o que mais aumentou" — duas
 * intenções, um cálculo só.
 */
export const compareMonths = (transactions, current, previous) => {
  const now = monthTotals(transactions, current.month, current.year);
  const before = monthTotals(transactions, previous.month, previous.year);

  const names = [...new Set([...Object.keys(now.categories), ...Object.keys(before.categories)])];
  const categories = names
    .map((name) => {
      const currentTotal = now.categories[name] || 0;
      const previousTotal = before.categories[name] || 0;
      return {
        name,
        current: currentTotal,
        previous: previousTotal,
        delta: currentTotal - previousTotal,
        deltaPercent: percentChange(currentTotal, previousTotal),
      };
    })
    .sort((a, b) => b.delta - a.delta);

  return {
    current: { income: now.income, expense: now.expense },
    previous: { income: before.income, expense: before.expense },
    deltaAbsolute: now.expense - before.expense,
    deltaPercent: percentChange(now.expense, before.expense),
    categories,
  };
};

/**
 * Ritmo de gasto e projeção de fechamento do mês. `pendingBills` entra
 * separado porque conta em aberto ainda não virou despesa — somá-la ao ritmo
 * diário contaria o mesmo dinheiro duas vezes.
 */
export const projectMonthEnd = ({ spent, day, totalDays, pendingBills = 0 }) => {
  const safeDay = Math.max(1, day);
  const dailyRate = spent / safeDay;
  const projected = dailyRate * totalDays;

  return {
    dailyRate,
    projected,
    projectedWithBills: projected + pendingBills,
    daysLeft: Math.max(0, totalDays - day),
  };
};

/**
 * Contas fixas cujo valor efetivo mudou. Compara as despesas geradas pela
 * própria conta (`billId`) em meses diferentes: a bill guarda só o valor
 * atual, então o histórico só existe nas transações que ela gerou.
 */
export const detectBillAmountChanges = (bills, transactions, options = {}) => {
  const { months = 4, minPercent = 0.15 } = options;

  const byBill = {};
  transactions.forEach((transaction) => {
    if (!transaction.billId) return;
    const date = getTransactionDate(transaction);
    if (!date) return;

    if (!byBill[transaction.billId]) byBill[transaction.billId] = [];
    byBill[transaction.billId].push({
      key: monthKey(date.getMonth(), date.getFullYear()),
      amount: transaction.amount,
      time: date.getTime(),
    });
  });

  const changes = [];

  bills.forEach((bill) => {
    const history = (byBill[bill.id] || []).sort((a, b) => a.time - b.time).slice(-months);
    if (history.length < 2) return;

    const oldest = history[0];
    const newest = history[history.length - 1];
    if (oldest.amount === 0) return;

    const deltaPercent = (newest.amount - oldest.amount) / oldest.amount;
    if (Math.abs(deltaPercent) < minPercent) return;

    changes.push({
      billId: bill.id,
      description: bill.description,
      from: oldest.amount,
      to: newest.amount,
      fromMonthKey: oldest.key,
      toMonthKey: newest.key,
      deltaPercent,
    });
  });

  return changes.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));
};

import { addMonths } from './dateHelpers';

/**
 * Calculadoras de decisão. Puras e sem dependência de dados: recebem números
 * já apurados para poderem ser usadas tanto pelo assistente quanto por
 * qualquer tela que queira simular um cenário.
 */

/**
 * "Posso gastar X?" — o que sobra é o saldo menos as contas que ainda vão sair
 * do caixa. Conta já quitada não entra: ela virou despesa e já está descontada
 * do saldo, então somá-la aqui descontaria o mesmo dinheiro duas vezes.
 */
export const affordability = ({
  balance,
  pendingBillsAmount = 0,
  amount = 0,
  budgetRemaining = null,
}) => {
  const free = balance - pendingBillsAmount;
  const afterSpending = free - amount;

  let verdict = 'folgado';
  if (afterSpending < 0) verdict = 'estoura';
  else if (free > 0 && afterSpending < free * 0.3) verdict = 'justo';

  return {
    free,
    afterSpending,
    verdict,
    budgetRemaining,
    exceedsBudget: budgetRemaining !== null && amount > budgetRemaining,
  };
};

/** Simulação de parcelamento: valor da parcela, janela e peso sobre a sobra. */
export const installmentPlan = (total, count, options = {}) => {
  const { startDate = new Date(), monthlyLeftover = null } = options;
  if (!(count >= 1)) return null;

  const installment = total / count;
  const first = { month: startDate.getMonth(), year: startDate.getFullYear() };
  const last = addMonths(first.month, first.year, count - 1);

  return {
    total,
    count,
    installment,
    first,
    last,
    shareOfLeftover:
      monthlyLeftover && monthlyLeftover > 0 ? installment / monthlyLeftover : null,
  };
};

/** "Quanto guardar por mês" até o prazo da meta. */
export const savingsPlan = ({ targetAmount, savedAmount, deadline, now = new Date() }) => {
  const missing = Math.max(0, targetAmount - savedAmount);
  if (missing === 0) return { missing: 0, monthsLeft: 0, monthlyNeeded: 0, feasible: true };

  if (!deadline) return { missing, monthsLeft: null, monthlyNeeded: null, feasible: null };

  const target = new Date(deadline);
  const monthsLeft =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());

  // Prazo vencido ou no mês corrente: o que falta tem que sair de uma vez.
  const safeMonths = Math.max(1, monthsLeft);

  return {
    missing,
    monthsLeft,
    monthlyNeeded: missing / safeMonths,
    overdue: monthsLeft <= 0,
    feasible: null,
  };
};

/** Sobra do mês depois das contas ainda em aberto. */
export const leftoverAfterBills = ({ monthIncome, monthExpense, pendingBillsAmount = 0 }) => ({
  leftover: monthIncome - monthExpense - pendingBillsAmount,
  pendingBillsAmount,
});

import { monthKey, daysInMonth } from './dateHelpers';

/** Vencimento no mês informado, com o dia limitado ao último dia do mês. */
export const clampToMonth = (dueDay, month, year) =>
  new Date(year, month, Math.min(dueDay, daysInMonth(month, year)));

export const getDaysUntilDue = (dueDay, selectedMonth = null, selectedYear = null) => {
  const today = new Date();
  const targetMonth = selectedMonth !== null ? selectedMonth : today.getMonth();
  const targetYear = selectedYear !== null ? selectedYear : today.getFullYear();

  // Dia 31 em um mês de 30 estouraria para o mês seguinte (31/02 vira 03/03),
  // fazendo a conta parecer que ainda falta uma semana para vencer.
  const dueDate = clampToMonth(dueDay, targetMonth, targetYear);

  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getInstallmentMonthYear = (createdMonth, createdYear, installmentNumber) => {
  const totalMonths = createdMonth + (installmentNumber - 1);
  const installmentMonth = totalMonths % 12;
  const installmentYear = createdYear + Math.floor(totalMonths / 12);
  return { installmentMonth, installmentYear };
};

/**
 * Mês/ano em que uma conta não-recorrente ocorre. Contas `fixa` ocorrem todo
 * mês, então não têm ocorrência única — retorna null.
 */
export const getBillOccurrence = (bill) => {
  if (bill.billType === 'unica') {
    const dueDate = new Date(bill.dueDate || bill.createdAt);
    return { month: dueDate.getMonth(), year: dueDate.getFullYear() };
  }

  if (bill.billType === 'parcelada') {
    // Cada parcela guarda o próprio vencimento. Parcelas criadas antes disso
    // não têm `dueDate`, então caem no cálculo antigo a partir da criação.
    if (bill.dueDate) {
      const dueDate = new Date(bill.dueDate);
      return { month: dueDate.getMonth(), year: dueDate.getFullYear() };
    }

    const createdDate = new Date(bill.createdAt);
    const { installmentMonth, installmentYear } = getInstallmentMonthYear(
      createdDate.getMonth(),
      createdDate.getFullYear(),
      bill.installmentNumber
    );
    return { month: installmentMonth, year: installmentYear };
  }

  return null;
};

/**
 * Data em que a conta vence na competência informada. Usada para datar a
 * despesa gerada ao quitar — sem isso, pagar um mês retroativo lançaria a
 * despesa na data de hoje, em outro mês.
 */
export const getBillDueDateFor = (bill, selectedMonth, selectedYear) => {
  if (bill.billType !== 'fixa' && bill.dueDate) {
    return new Date(bill.dueDate);
  }

  return clampToMonth(bill.dueDay, selectedMonth, selectedYear);
};

/**
 * Uma conta `fixa` se repete todo mês, então o pagamento é registrado por
 * competência em `paidMonths`. Contas `unica`/`parcelada` só ocorrem uma vez —
 * qualquer registro em `paidMonths` já as quita.
 */
export const isBillPaidForMonth = (bill, selectedMonth, selectedYear) => {
  const paidMonths = bill.paidMonths || [];

  if (bill.billType === 'fixa') {
    if (selectedMonth === undefined || selectedMonth === null) return false;
    return paidMonths.includes(monthKey(selectedMonth, selectedYear));
  }

  return paidMonths.length > 0;
};

/** Competência a usar ao quitar a conta no mês visualizado. */
export const getBillPaymentMonthKey = (bill, selectedMonth, selectedYear) => {
  if (bill.billType === 'fixa') return monthKey(selectedMonth, selectedYear);

  const occurrence = getBillOccurrence(bill);
  return occurrence
    ? monthKey(occurrence.month, occurrence.year)
    : monthKey(selectedMonth, selectedYear);
};

export const getBillStatus = (bill, selectedMonth = null, selectedYear = null) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const targetMonth = selectedMonth !== null ? selectedMonth : currentMonth;
  const targetYear = selectedYear !== null ? selectedYear : currentYear;

  if (isBillPaidForMonth(bill, targetMonth, targetYear)) {
    return { text: 'Pago', color: '#10b981' };
  }

  const isCurrentMonth = targetMonth === currentMonth && targetYear === currentYear;
  if (!isCurrentMonth) {
    const isPast =
      targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth);
    if (isPast) return { text: 'Vencida', color: '#ef4444' };
    return { text: `Dia ${bill.dueDay}`, color: '#6b7280' };
  }

  const days = getDaysUntilDue(bill.dueDay, targetMonth, targetYear);
  if (days === 0) return { text: 'Vence hoje', color: '#ef4444' };
  if (days < 0) return { text: 'Vencida', color: '#ef4444' };
  if (days <= 3) return { text: `${days} dias`, color: '#f59e0b' };
  return { text: `${days} dias`, color: '#6b7280' };
};

export const filterBillsByMonth = (bills, selectedMonth, selectedYear) => {
  return bills.filter(bill => {
    if (bill.billType === 'fixa') {
      // Recorrente: aparece em todo mês a partir da criação.
      const createdDate = new Date(bill.createdAt);
      return (
        selectedYear > createdDate.getFullYear() ||
        (selectedYear === createdDate.getFullYear() && selectedMonth >= createdDate.getMonth())
      );
    }

    const occurrence = getBillOccurrence(bill);
    return !!occurrence && occurrence.month === selectedMonth && occurrence.year === selectedYear;
  });
};

/**
 * Soma das contas em aberto no mês. Usado para projetar quanto ainda sai do
 * caixa antes do fim do mês.
 */
export const getPendingBillsTotal = (bills, selectedMonth, selectedYear) =>
  filterBillsByMonth(bills, selectedMonth, selectedYear)
    .filter(bill => !isBillPaidForMonth(bill, selectedMonth, selectedYear))
    .reduce((sum, bill) => sum + bill.amount, 0);

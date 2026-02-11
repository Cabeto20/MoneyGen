export const getDaysUntilDue = (dueDay, selectedMonth = null, selectedYear = null) => {
  const today = new Date();
  const targetMonth = selectedMonth !== null ? selectedMonth : today.getMonth();
  const targetYear = selectedYear !== null ? selectedYear : today.getFullYear();
  
  const dueDate = new Date(targetYear, targetMonth, dueDay);
  
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getBillStatus = (dueDay, isPaid, selectedMonth = null, selectedYear = null) => {
  if (isPaid) return { text: 'Pago', color: '#10b981' };
  
  const days = getDaysUntilDue(dueDay, selectedMonth, selectedYear);
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const targetMonth = selectedMonth !== null ? selectedMonth : currentMonth;
  const targetYear = selectedYear !== null ? selectedYear : currentYear;
  
  const isCurrentMonth = targetMonth === currentMonth && targetYear === currentYear;
  
  if (!isCurrentMonth) {
    return { text: `Dia ${dueDay}`, color: '#6b7280' };
  }
  
  if (days === 0) return { text: 'Vence hoje', color: '#ef4444' };
  if (days < 0) return { text: 'Vencida', color: '#ef4444' };
  if (days <= 3) return { text: `${days} dias`, color: '#f59e0b' };
  return { text: `${days} dias`, color: '#6b7280' };
};

export const getInstallmentMonthYear = (createdMonth, createdYear, installmentNumber) => {
  const totalMonths = createdMonth + (installmentNumber - 1);
  const installmentMonth = totalMonths % 12;
  const installmentYear = createdYear + Math.floor(totalMonths / 12);
  return { installmentMonth, installmentYear };
};

export const filterBillsByMonth = (bills, selectedMonth, selectedYear) => {
  return bills.filter(bill => {
    const createdDate = new Date(bill.createdAt);
    const createdMonth = createdDate.getMonth();
    const createdYear = createdDate.getFullYear();
    
    if (bill.billType === 'fixa') {
      return (selectedYear > createdYear) || 
             (selectedYear === createdYear && selectedMonth >= createdMonth);
    }
    
    if (bill.billType === 'unica') {
      const dueDate = new Date(bill.dueDate || bill.createdAt);
      const dueMonth = dueDate.getMonth();
      const dueYear = dueDate.getFullYear();
      return selectedMonth === dueMonth && selectedYear === dueYear;
    }
    
    if (bill.billType === 'parcelada') {
      const { installmentMonth, installmentYear } = getInstallmentMonthYear(
        createdMonth, 
        createdYear, 
        bill.installmentNumber
      );
      return installmentMonth === selectedMonth && installmentYear === selectedYear;
    }
    
    return false;
  });
};

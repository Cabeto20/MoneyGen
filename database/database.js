import AsyncStorage from '@react-native-async-storage/async-storage';

const TRANSACTIONS_KEY = 'transactions';
const BILLS_KEY = 'bills';

export const initDatabase = async () => {
  // AsyncStorage não precisa de inicialização
};

export const addTransaction = async (description, amount, type, category = '') => {
  const transactions = await getTransactions();
  const newTransaction = {
    id: Date.now(),
    description,
    amount,
    type,
    category,
    date: new Date().toLocaleDateString('pt-BR')
  };
  
  const updatedTransactions = [newTransaction, ...transactions];
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedTransactions));
  return newTransaction;
};

export const getTransactions = async () => {
  try {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const getBalance = async () => {
  const transactions = await getTransactions();
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  return {
    income,
    expense,
    balance: income - expense
  };
};

export const addBill = async (description, amount, dueDay, category = '', billType = 'fixa', installments = 1, dueDate = null) => {
  const bills = await getBills();
  
  if (billType === 'parcelada') {
    // Cria múltiplas contas para parcelas
    const newBills = [];
    for (let i = 1; i <= installments; i++) {
      const newBill = {
        id: Date.now() + i,
        description: `${description} (${i}/${installments})`,
        amount,
        dueDay,
        category,
        billType,
        installmentNumber: i,
        totalInstallments: installments,
        isPaid: false,
        createdAt: new Date().toISOString()
      };
      newBills.push(newBill);
    }
    const updatedBills = [...newBills, ...bills];
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(updatedBills));
    return newBills;
  } else {
    const newBill = {
      id: Date.now(),
      description,
      amount,
      dueDay,
      category,
      billType,
      isPaid: false,
      createdAt: new Date().toISOString(),
      dueDate: dueDate ? dueDate.toISOString() : new Date().toISOString()
    };
    
    const updatedBills = [newBill, ...bills];
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(updatedBills));
    return newBill;
  }
};

export const getBills = async () => {
  try {
    const data = await AsyncStorage.getItem(BILLS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const markBillAsPaid = async (billId) => {
  const bills = await getBills();
  const bill = bills.find(b => b.id === billId);
  
  if (bill && !bill.isPaid) {
    // Registra como transação de despesa
    await addTransaction(bill.description, bill.amount, 'expense', bill.category);
    
    // Marca a conta como paga
    const updatedBills = bills.map(b => 
      b.id === billId ? { ...b, isPaid: true } : b
    );
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(updatedBills));
  }
};

export const clearAllData = async () => {
  await AsyncStorage.removeItem(TRANSACTIONS_KEY);
  await AsyncStorage.removeItem(BILLS_KEY);
};

export const exportBackup = async () => {
  const transactions = await getTransactions();
  const bills = await getBills();
  
  return {
    transactions,
    bills,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
};

export const importBackup = async (backupData) => {
  if (backupData.transactions) {
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(backupData.transactions));
  }
  if (backupData.bills) {
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(backupData.bills));
  }
};

export const exportToCSV = async () => {
  const transactions = await getTransactions();
  const bills = await getBills();
  
  // CSV das transações
  let csvTransactions = 'Tipo,Descrição,Valor,Categoria,Data\n';
  transactions.forEach(t => {
    csvTransactions += `${t.type === 'income' ? 'Receita' : 'Despesa'},"${t.description}",${t.amount},"${t.category}",${t.date}\n`;
  });
  
  // CSV das contas
  let csvBills = 'Descrição,Valor,Dia Vencimento,Categoria,Tipo,Status\n';
  bills.forEach(b => {
    csvBills += `"${b.description}",${b.amount},${b.dueDay},"${b.category}",${b.billType || 'fixa'},${b.isPaid ? 'Pago' : 'Pendente'}\n`;
  });
  
  return { csvTransactions, csvBills };
};
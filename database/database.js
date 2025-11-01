import AsyncStorage from '@react-native-async-storage/async-storage';

const TRANSACTIONS_KEY = 'transactions';

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
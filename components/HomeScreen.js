import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatCurrency';
import { addTransaction as saveTransaction, getTransactions, getBalance } from '../database/database';

const HomeScreen = () => {
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState({ income: 0, expense: 0, balance: 0 });
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const loadData = async () => {
    const txs = await getTransactions();
    const bal = await getBalance();
    setTransactions(txs);
    setBalance(bal);
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatInputCurrency = (value) => {
    const numericValue = value.replace(/\D/g, '');
    const floatValue = parseFloat(numericValue) / 100;
    return floatValue;
  };

  const handleAmountChange = (text) => {
    const numericValue = text.replace(/\D/g, '');
    const floatValue = parseFloat(numericValue) / 100;
    
    if (numericValue === '') {
      setAmount('');
      setDisplayAmount('');
      return;
    }
    
    setAmount(floatValue.toString());
    setDisplayAmount(formatCurrency(floatValue));
  };

  const addTransactionHandler = async (type) => {
    if (!amount || !description) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    
    await saveTransaction(description, parseFloat(amount), type);
    await loadData();
    setAmount('');
    setDisplayAmount('');
    setDescription('');
    setShowAddForm(false);
  };



  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo Total</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(balance.balance)}</Text>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Receitas</Text>
            <Text style={[styles.summaryAmount, styles.income]}>+{formatCurrency(balance.income)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Despesas</Text>
            <Text style={[styles.summaryAmount, styles.expense]}>-{formatCurrency(balance.expense)}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => setShowAddForm(!showAddForm)}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Nova Transação</Text>
      </TouchableOpacity>

      {showAddForm && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Descrição"
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            style={styles.input}
            placeholder="R$ 0,00"
            placeholderTextColor="#666"
            value={displayAmount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.typeButton, styles.incomeButton]} 
              onPress={() => addTransactionHandler('income')}
            >
              <Text style={styles.buttonText}>Receita</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeButton, styles.expenseButton]} 
              onPress={() => addTransactionHandler('expense')}
            >
              <Text style={styles.buttonText}>Despesa</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.transactionsList}>
        <Text style={styles.sectionTitle}>Transações Recentes</Text>
        {transactions.map((transaction) => (
          <View key={transaction.id} style={styles.transactionItem}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionDescription}>{transaction.description}</Text>
              <Text style={styles.transactionDate}>{transaction.date}</Text>
            </View>
            <Text style={[
              styles.transactionAmount,
              transaction.type === 'income' ? styles.income : styles.expense
            ]}>
              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#8b5cf6',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8b5cf6',
    textAlign: 'center',
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#ccc',
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  income: {
    color: '#10b981',
  },
  expense: {
    color: '#ef4444',
  },
  addButton: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  addForm: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  incomeButton: {
    backgroundColor: '#10b981',
  },
  expenseButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionsList: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  transactionItem: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
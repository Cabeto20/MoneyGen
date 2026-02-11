import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getTransactions } from '../database/database';

const TransactionsScreen = ({ navigation }) => {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('current');

  useFocusEffect(
    React.useCallback(() => {
      const loadTransactions = async () => {
        const txs = await getTransactions();
        setTransactions(txs);
      };
      loadTransactions();
    }, [])
  );

  const getFilteredTransactions = () => {
    let filtered = transactions;
    
    if (filter !== 'all') {
      filtered = filtered.filter(transaction => transaction.type === filter);
    }
    
    if (monthFilter !== 'all') {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      let targetMonth, targetYear;
      
      if (monthFilter === 'current') {
        targetMonth = currentMonth;
        targetYear = currentYear;
      } else if (monthFilter === 'last') {
        targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      }
      
      filtered = filtered.filter(transaction => {
        try {
          const dateParts = transaction.date.split('/');
          if (dateParts.length !== 3) return false;
          
          const transactionDate = new Date(
            parseInt(dateParts[2]), 
            parseInt(dateParts[1]) - 1, 
            parseInt(dateParts[0])
          );
          
          return transactionDate.getMonth() === targetMonth && 
                 transactionDate.getFullYear() === targetYear;
        } catch (error) {
          return false;
        }
      });
    }
    
    return filtered;
  };

  return (
    <View style={styles.container}>
      <View style={styles.monthFilterContainer}>
        <TouchableOpacity 
          style={[styles.monthButton, monthFilter === 'last' && styles.activeMonthFilter]}
          onPress={() => setMonthFilter('last')}
        >
          <Text style={[styles.monthText, monthFilter === 'last' && styles.activeMonthText]}>Anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.monthButton, monthFilter === 'current' && styles.activeMonthFilter]}
          onPress={() => setMonthFilter('current')}
        >
          <Text style={[styles.monthText, monthFilter === 'current' && styles.activeMonthText]}>Este Mês</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.monthButton, monthFilter === 'all' && styles.activeMonthFilter]}
          onPress={() => setMonthFilter('all')}
        >
          <Text style={[styles.monthText, monthFilter === 'all' && styles.activeMonthText]}>Todos</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'income' && styles.activeFilter]}
          onPress={() => setFilter('income')}
        >
          <Text style={[styles.filterText, filter === 'income' && styles.activeFilterText]}>Receitas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'expense' && styles.activeFilter]}
          onPress={() => setFilter('expense')}
        >
          <Text style={[styles.filterText, filter === 'expense' && styles.activeFilterText]}>Despesas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.transactionsList}>
        {getFilteredTransactions().length > 0 ? (
          getFilteredTransactions().map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: transaction.type === 'income' ? '#10b981' : '#ef4444' }
                ]}>
                  <Ionicons 
                    name={transaction.type === 'income' ? 'arrow-down' : 'arrow-up'} 
                    size={20} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <Text style={styles.transactionCategory}>{transaction.category}</Text>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                </View>
              </View>
              <Text style={[
                styles.transactionAmount,
                { color: transaction.type === 'income' ? '#10b981' : '#ef4444' }
              ]}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma transação encontrada</Text>
            <Text style={styles.emptySubtext}>Adicione receitas ou pague contas</Text>
          </View>
        )}
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
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 5,
  },
  filterButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeFilter: {
    backgroundColor: '#8b5cf6',
  },
  filterText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  monthFilterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 5,
  },
  monthButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeMonthFilter: {
    backgroundColor: '#8b5cf6',
  },
  monthText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '500',
  },
  activeMonthText: {
    color: '#fff',
  },
  transactionsList: {
    flex: 1,
  },
  transactionItem: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  transactionCategory: {
    fontSize: 12,
    color: '#8b5cf6',
    marginTop: 2,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TransactionsScreen;
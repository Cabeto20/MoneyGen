import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getTransactions, deleteTransaction } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';

const CATEGORY_ICONS = {
  'Alimentação': 'fast-food',
  'Transporte': 'car',
  'Moradia': 'home',
  'Saúde': 'medkit',
  'Educação': 'school',
  'Lazer': 'game-controller',
  'Compras': 'bag-handle',
  'Serviços': 'construct',
  'Salário': 'wallet',
  'Freelance': 'laptop',
  'Investimentos': 'trending-up',
  'Vendas': 'pricetag',
  'Bonificação': 'gift',
  'Prêmio': 'trophy',
  'Aluguel Recebido': 'business',
};

const TransactionsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('current');

  const styles = createStyles(theme);

  useFocusEffect(
    React.useCallback(() => {
      const loadTransactions = async () => {
        const txs = await getTransactions();
        setTransactions(txs);
      };
      loadTransactions();
    }, [])
  );

  const filteredTransactions = useMemo(() => {
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
  }, [transactions, filter, monthFilter]);

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const handleDelete = (transaction) => {
    Alert.alert(
      'Excluir Transação',
      `Deseja excluir "${transaction.description}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(transaction.id);
            const txs = await getTransactions();
            setTransactions(txs);
          }
        }
      ]
    );
  };

  const getCategoryIcon = (category) => {
    return CATEGORY_ICONS[category] || 'ellipse';
  };

  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: theme.success }]}>
          <Text style={styles.summaryLabel}>Receitas</Text>
          <Text style={[styles.summaryValue, { color: theme.success }]}>
            +{formatCurrency(summary.income)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: theme.error }]}>
          <Text style={styles.summaryLabel}>Despesas</Text>
          <Text style={[styles.summaryValue, { color: theme.error }]}>
            -{formatCurrency(summary.expense)}
          </Text>
        </View>
      </View>

      {/* Month Filter */}
      <View style={styles.filterContainer}>
        {[
          { key: 'last', label: 'Anterior' },
          { key: 'current', label: 'Este Mês' },
          { key: 'all', label: 'Todos' },
        ].map(item => (
          <TouchableOpacity 
            key={item.key}
            style={[styles.filterButton, monthFilter === item.key && styles.activeFilter]}
            onPress={() => setMonthFilter(item.key)}
          >
            <Text style={[styles.filterText, monthFilter === item.key && styles.activeFilterText]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Type Filter */}
      <View style={styles.filterContainer}>
        {[
          { key: 'all', label: 'Todas' },
          { key: 'income', label: 'Receitas' },
          { key: 'expense', label: 'Despesas' },
        ].map(item => (
          <TouchableOpacity 
            key={item.key}
            style={[styles.filterButton, filter === item.key && styles.activeFilter]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[styles.filterText, filter === item.key && styles.activeFilterText]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.transactionsList} showsVerticalScrollIndicator={false}>
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <TouchableOpacity 
              key={transaction.id} 
              style={styles.transactionItem}
              onLongPress={() => handleDelete(transaction)}
              activeOpacity={0.7}
            >
              <View style={styles.transactionLeft}>
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: transaction.type === 'income' ? theme.successLight : theme.errorLight }
                ]}>
                  <Ionicons 
                    name={getCategoryIcon(transaction.category)} 
                    size={20} 
                    color={transaction.type === 'income' ? theme.success : theme.error} 
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <View style={styles.transactionMeta}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.transactionCategory}>{transaction.category}</Text>
                    </View>
                    <Text style={styles.transactionDate}>{transaction.date}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.amountContainer}>
                <Text style={[
                  styles.transactionAmount,
                  { color: transaction.type === 'income' ? theme.success : theme.error }
                ]}>
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </Text>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => handleDelete(transaction)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={theme.border} />
            <Text style={styles.emptyText}>Nenhuma transação encontrada</Text>
            <Text style={styles.emptySubtext}>Adicione receitas ou pague contas para ver aqui</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 4,
    elevation: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeFilter: {
    backgroundColor: theme.primary,
    elevation: 2,
  },
  filterText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#fff',
  },
  transactionsList: {
    flex: 1,
  },
  transactionItem: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '600',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: theme.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  transactionCategory: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: 17,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.7,
  },
});

export default TransactionsScreen;
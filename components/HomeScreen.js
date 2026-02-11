import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getBalance, getBills, markBillAsPaid } from '../database/database';
import { getBillStatus, filterBillsByMonth } from '../utils/billHelpers';
import { useTheme } from '../contexts/ThemeContext';
import FloatingActionButton from './FloatingActionButton';
import SearchBar from './SearchBar';

const HomeScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [balance, setBalance] = useState({ income: 0, expense: 0, balance: 0 });
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme);

  const loadData = async () => {
    const bal = await getBalance();
    const billsData = await getBills();
    setBalance(bal);
    setBills(billsData);
    setFilteredBills(billsData);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredBills(bills);
    } else {
      const filtered = bills.filter(bill => 
        bill.description.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredBills(filtered);
    }
  };

  const getDaysUntilDue = (dueDay) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    let dueDate = new Date(currentYear, currentMonth, dueDay);
    
    if (dueDay < currentDay) {
      dueDate = new Date(currentYear, currentMonth + 1, dueDay);
    }
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getBillStatusLocal = (dueDay, isPaid) => {
    if (isPaid) return { text: 'Pago', color: theme.success };
    
    const days = getDaysUntilDue(dueDay);
    if (days === 0) return { text: 'Vence hoje', color: theme.error };
    if (days <= 3) return { text: `${days} dias`, color: theme.warning };
    return { text: `${days} dias`, color: theme.textSecondary };
  };

  const markAsPaid = async (billId) => {
    await markBillAsPaid(billId);
    await loadData();
  };

  const getCurrentMonthBills = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const filtered = filterBillsByMonth(searchQuery ? filteredBills : bills, currentMonth, currentYear)
      .filter(bill => !bill.isPaid);
    return filtered.slice(0, 5);
  };

  const handleAddExpense = () => {
    navigation.navigate('Transações', { 
      screen: 'AddExpense'
    });
  };

  const handleAddIncome = () => {
    navigation.navigate('Transações', { 
      screen: 'AddTransaction'
    });
  };

  const handleAddBill = () => {
    navigation.navigate('Contas', { 
      screen: 'AddBill'
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <SearchBar 
          onSearch={handleSearch}
          placeholder="Buscar contas..."
        />
        
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Total</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balance.balance)}</Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Receitas</Text>
              <Text style={[styles.summaryAmount, { color: theme.success }]}>+{formatCurrency(balance.income)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Despesas</Text>
              <Text style={[styles.summaryAmount, { color: theme.error }]}>-{formatCurrency(balance.expense)}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contas do Mês</Text>
          {getCurrentMonthBills().length > 0 ? (
            getCurrentMonthBills().map((bill) => {
              const status = getBillStatusLocal(bill.dueDay, bill.isPaid);
              return (
                <View key={bill.id} style={styles.billItem}>
                  <View style={styles.billInfo}>
                    <Text style={styles.billDescription}>{bill.description}</Text>
                    <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                    <Text style={[styles.billStatus, { color: status.color }]}>
                      {status.text}
                    </Text>
                  </View>
                  <View style={styles.billActions}>
                    <Text style={styles.billDay}>Dia {bill.dueDay}</Text>
                    <TouchableOpacity 
                      style={styles.payButton}
                      onPress={() => markAsPaid(bill.id)}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>Nenhuma conta próxima ao vencimento</Text>
          )}
        </View>
      </ScrollView>
      
      <FloatingActionButton
        onAddExpense={handleAddExpense}
        onAddIncome={handleAddIncome}
        onAddBill={handleAddBill}
      />
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  balanceCard: {
    backgroundColor: theme.card,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.primary,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.primary,
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
    color: theme.textSecondary,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  billItem: {
    backgroundColor: theme.card,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  billInfo: {
    flex: 1,
  },
  billDescription: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  billAmount: {
    fontSize: 14,
    color: theme.primary,
    marginTop: 2,
  },
  billStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  billActions: {
    alignItems: 'center',
  },
  billDay: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  payButton: {
    backgroundColor: theme.success,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default HomeScreen;
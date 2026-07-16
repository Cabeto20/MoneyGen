import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getBalance, getBills, markBillAsPaid } from '../database/database';
import { getBillStatus, filterBillsByMonth } from '../utils/billHelpers';
import { useTheme } from '../contexts/ThemeContext';
import FloatingActionButton from './FloatingActionButton';
import SearchBar from './SearchBar';

const BILL_CATEGORY_ICONS = {
  'Aluguel': 'home',
  'Energia': 'flash',
  'Água': 'water',
  'Internet': 'wifi',
  'Telefone': 'call',
  'Cartão': 'card',
  'Financiamento': 'cash',
  'Seguro': 'shield-checkmark',
};

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

  const currentMonthBills = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const source = searchQuery ? filteredBills : bills;
    return filterBillsByMonth(source, currentMonth, currentYear)
      .filter(bill => !bill.isPaid)
      .slice(0, 5);
  }, [bills, filteredBills, searchQuery]);

  const confirmMarkAsPaid = (bill) => {
    Alert.alert(
      'Marcar como Paga',
      `Confirma pagamento de "${bill.description}" (${formatCurrency(bill.amount)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: async () => {
            await markBillAsPaid(bill.id);
            await loadData();
          }
        }
      ]
    );
  };

  const handleAddExpense = () => {
    navigation.navigate('Transações', { screen: 'AddExpense' });
  };

  const handleAddIncome = () => {
    navigation.navigate('Transações', { screen: 'AddTransaction' });
  };

  const handleAddBill = () => {
    navigation.navigate('Contas', { screen: 'AddBill' });
  };

  const getBalanceColor = () => {
    if (balance.balance > 0) return theme.success;
    if (balance.balance < 0) return theme.error;
    return theme.text;
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SearchBar 
          onSearch={handleSearch}
          placeholder="Buscar contas..."
        />
        
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet-outline" size={22} color={theme.primary} />
            <Text style={styles.balanceLabel}>Saldo Total</Text>
          </View>
          <Text style={[styles.balanceAmount, { color: getBalanceColor() }]}>
            {formatCurrency(balance.balance)}
          </Text>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.successLight }]}>
                <Ionicons name="arrow-down" size={16} color={theme.success} />
              </View>
              <View>
                <Text style={styles.summaryLabel}>Receitas</Text>
                <Text style={[styles.summaryAmount, { color: theme.success }]}>
                  +{formatCurrency(balance.income)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.errorLight }]}>
                <Ionicons name="arrow-up" size={16} color={theme.error} />
              </View>
              <View>
                <Text style={styles.summaryLabel}>Despesas</Text>
                <Text style={[styles.summaryAmount, { color: theme.error }]}>
                  -{formatCurrency(balance.expense)}
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <TouchableOpacity 
            style={styles.quickStatCard}
            onPress={() => navigation.navigate('Transações')}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={24} color={theme.primary} />
            <Text style={styles.quickStatLabel}>Transações</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickStatCard}
            onPress={() => navigation.navigate('Contas')}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar" size={24} color={theme.warning} />
            <Text style={styles.quickStatLabel}>Contas</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickStatCard}
            onPress={() => navigation.navigate('Estatísticas')}
            activeOpacity={0.7}
          >
            <Ionicons name="stats-chart" size={24} color={theme.success} />
            <Text style={styles.quickStatLabel}>Relatórios</Text>
          </TouchableOpacity>
        </View>

        {/* Bills Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.warning} />
            <Text style={styles.sectionTitle}>Contas do Mês</Text>
            <Text style={styles.sectionCount}>{currentMonthBills.length}</Text>
          </View>
          
          {currentMonthBills.length > 0 ? (
            currentMonthBills.map((bill) => {
              const status = getBillStatus(bill.dueDay, bill.isPaid);
              return (
                <View key={bill.id} style={styles.billItem}>
                  <View style={[styles.billIcon, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons 
                      name={BILL_CATEGORY_ICONS[bill.category] || 'document-text'} 
                      size={20} 
                      color={theme.primary} 
                    />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billDescription}>{bill.description}</Text>
                    <View style={styles.billMeta}>
                      <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                      <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                      <Text style={[styles.billStatus, { color: status.color }]}>
                        {status.text}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.billActions}>
                    <Text style={styles.billDay}>Dia {bill.dueDay}</Text>
                    <TouchableOpacity 
                      style={styles.payButton}
                      onPress={() => confirmMarkAsPaid(bill)}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={theme.success} />
              <Text style={styles.emptyText}>Tudo em dia!</Text>
              <Text style={styles.emptySubtext}>Nenhuma conta pendente este mês</Text>
            </View>
          )}
        </View>

        <View style={{ height: 80 }} />
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
    padding: 24,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'left',
    marginVertical: 8,
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  quickStats: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  quickStatLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primary,
    backgroundColor: theme.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  billItem: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  billIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  billInfo: {
    flex: 1,
  },
  billDescription: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '600',
  },
  billMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  billAmount: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '700',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  billStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  billActions: {
    alignItems: 'center',
    gap: 6,
  },
  billDay: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: theme.success,
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: theme.card,
    borderRadius: 14,
    elevation: 1,
  },
  emptyText: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
});

export default HomeScreen;
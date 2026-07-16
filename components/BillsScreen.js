import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getBills, markBillAsPaid, deleteBill } from '../database/database';
import { getBillStatus, filterBillsByMonth } from '../utils/billHelpers';
import { useTheme } from '../contexts/ThemeContext';

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

const BillsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [bills, setBills] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const styles = createStyles(theme);

  const loadBills = async () => {
    const billsData = await getBills();
    setBills(billsData);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadBills();
    }, [])
  );

  const filteredBills = useMemo(() => {
    return filterBillsByMonth(bills, selectedMonth, selectedYear);
  }, [bills, selectedMonth, selectedYear]);

  const monthSummary = useMemo(() => {
    const total = filteredBills.reduce((sum, b) => sum + b.amount, 0);
    const paid = filteredBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.amount, 0);
    const pending = total - paid;
    const paidCount = filteredBills.filter(b => b.isPaid).length;
    const pendingCount = filteredBills.length - paidCount;
    return { total, paid, pending, paidCount, pendingCount };
  }, [filteredBills]);

  const confirmMarkAsPaid = (bill) => {
    Alert.alert(
      'Marcar como Paga',
      `Confirma pagamento de "${bill.description}" no valor de ${formatCurrency(bill.amount)}?\n\nUma despesa será criada automaticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: async () => {
            await markBillAsPaid(bill.id);
            await loadBills();
          }
        }
      ]
    );
  };

  const handleDelete = (bill) => {
    Alert.alert(
      'Excluir Conta',
      `Deseja excluir "${bill.description}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            await deleteBill(bill.id);
            await loadBills();
          }
        }
      ]
    );
  };

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const getMonthYearText = () => {
    const date = new Date(selectedYear, selectedMonth);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getCategoryIcon = (category) => {
    return BILL_CATEGORY_ICONS[category] || 'document-text';
  };

  return (
    <View style={styles.container}>
      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.billButton} 
          onPress={() => navigation.navigate('AddBill')}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Nova Conta</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.transactionButton} 
          onPress={() => navigation.navigate('AddTransaction')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Receita</Text>
        </TouchableOpacity>
      </View>

      {/* Month Navigator */}
      <View style={styles.monthNavigator}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => changeMonth('prev')}
        >
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        
        <View style={styles.monthDisplay}>
          <Text style={styles.monthYearText}>{getMonthYearText()}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => changeMonth('next')}
        >
          <Ionicons name="chevron-forward" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Monthly Summary */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryItem, { borderBottomColor: theme.warning }]}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatCurrency(monthSummary.total)}
          </Text>
          <Text style={styles.summaryCount}>{filteredBills.length} contas</Text>
        </View>
        <View style={[styles.summaryItem, { borderBottomColor: theme.success }]}>
          <Text style={styles.summaryLabel}>Pagas</Text>
          <Text style={[styles.summaryValue, { color: theme.success }]}>
            {formatCurrency(monthSummary.paid)}
          </Text>
          <Text style={styles.summaryCount}>{monthSummary.paidCount} contas</Text>
        </View>
        <View style={[styles.summaryItem, { borderBottomColor: theme.error }]}>
          <Text style={styles.summaryLabel}>Pendentes</Text>
          <Text style={[styles.summaryValue, { color: theme.error }]}>
            {formatCurrency(monthSummary.pending)}
          </Text>
          <Text style={styles.summaryCount}>{monthSummary.pendingCount} contas</Text>
        </View>
      </View>

      {/* Bills List */}
      <ScrollView style={styles.billsList} showsVerticalScrollIndicator={false}>
        {filteredBills.length > 0 ? (
          filteredBills.map((bill) => {
            const status = getBillStatus(bill.dueDay, bill.isPaid, selectedMonth, selectedYear);
            return (
              <TouchableOpacity 
                key={bill.id} 
                style={[styles.billItem, bill.isPaid && styles.billItemPaid]}
                onLongPress={() => handleDelete(bill)}
                activeOpacity={0.7}
              >
                <View style={styles.billLeft}>
                  <View style={[
                    styles.billIcon,
                    { backgroundColor: bill.isPaid ? theme.successLight : theme.primaryLight }
                  ]}>
                    <Ionicons 
                      name={bill.isPaid ? 'checkmark-circle' : getCategoryIcon(bill.category)} 
                      size={22} 
                      color={bill.isPaid ? theme.success : theme.primary} 
                    />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={[styles.billDescription, bill.isPaid && styles.billDescriptionPaid]}>
                      {bill.description}
                    </Text>
                    <View style={styles.billMeta}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.billCategory}>{bill.category}</Text>
                      </View>
                      <Text style={styles.billDay}>Dia {bill.dueDay}</Text>
                    </View>
                    <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                  </View>
                </View>
                <View style={styles.billActions}>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.billStatus, { color: status.color }]}>
                      {status.text}
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    {!bill.isPaid && (
                      <TouchableOpacity 
                        style={styles.payButton}
                        onPress={() => confirmMarkAsPaid(bill)}
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(bill)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={theme.border} />
            <Text style={styles.emptyText}>Nenhuma conta neste mês</Text>
            <Text style={styles.emptySubtext}>Adicione uma conta para começar a controlar</Text>
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  billButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    backgroundColor: theme.primary,
    elevation: 3,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  transactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    backgroundColor: theme.success,
    elevation: 3,
    shadowColor: theme.success,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  navButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme.primaryLight,
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthYearText: {
    color: theme.text,
    fontSize: 17,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  summaryCount: {
    fontSize: 10,
    color: theme.textSecondary,
    marginTop: 2,
  },
  billsList: {
    flex: 1,
  },
  billItem: {
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
  billItemPaid: {
    opacity: 0.7,
  },
  billLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  billDescriptionPaid: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  billMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: theme.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  billCategory: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: '600',
  },
  billDay: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  billAmount: {
    fontSize: 14,
    color: theme.primary,
    marginTop: 4,
    fontWeight: '700',
  },
  billActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  billStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButton: {
    backgroundColor: theme.success,
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  emptyContainer: {
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

export default BillsScreen;
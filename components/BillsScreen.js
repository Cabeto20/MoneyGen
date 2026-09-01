import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getBills, markBillAsPaid, unmarkBillAsPaid, deleteBill } from '../database/database';
import { getBillStatus, filterBillsByMonth, isBillPaidForMonth } from '../utils/billHelpers';
import { addMonths, getMonthLabel } from '../utils/dateHelpers';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive, gridContainer, gridItemWidth } from '../utils/responsive';
import { BILL_CATEGORY_ICONS } from '../utils/categories';
import SearchBar from './SearchBar';

const BillsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('all');

  const styles = createStyles(theme, r);

  const loadBills = useCallback(async () => {
    setBills(await getBills());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBills();
    }, [loadBills])
  );

  const filteredBills = useMemo(() => {
    const monthBills = filterBillsByMonth(bills, selectedMonth, selectedYear);
    if (!searchQuery.trim()) return monthBills;

    const query = searchQuery.toLowerCase();
    return monthBills.filter(
      bill =>
        bill.description.toLowerCase().includes(query) ||
        (bill.category || '').toLowerCase().includes(query)
    );
  }, [bills, selectedMonth, selectedYear, searchQuery]);

  const monthSummary = useMemo(() => {
    const paidBills = filteredBills.filter(bill =>
      isBillPaidForMonth(bill, selectedMonth, selectedYear)
    );
    const total = filteredBills.reduce((sum, b) => sum + b.amount, 0);
    const paid = paidBills.reduce((sum, b) => sum + b.amount, 0);

    return {
      total,
      paid,
      pending: total - paid,
      paidCount: paidBills.length,
      pendingCount: filteredBills.length - paidBills.length,
    };
  }, [filteredBills, selectedMonth, selectedYear]);

  const visibleBills = useMemo(() => {
    if (statusFilter === 'all') return filteredBills;
    return filteredBills.filter(bill => {
      const isPaid = isBillPaidForMonth(bill, selectedMonth, selectedYear);
      return statusFilter === 'paid' ? isPaid : !isPaid;
    });
  }, [filteredBills, statusFilter, selectedMonth, selectedYear]);

  const toggleStatusFilter = (filter) => {
    setStatusFilter(current => (current === filter ? 'all' : filter));
  };

  const confirmMarkAsPaid = (bill) => {
    const competence = bill.billType === 'fixa'
      ? `\n\nCompetência: ${getMonthLabel(selectedMonth, selectedYear)}.`
      : '';

    Alert.alert(
      'Marcar como Paga',
      `Confirma pagamento de "${bill.description}" no valor de ${formatCurrency(
        bill.amount
      )}?${competence}\n\nUma despesa será criada automaticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await markBillAsPaid(bill.id, selectedMonth, selectedYear);
            await loadBills();
          },
        },
      ]
    );
  };

  const confirmUndoPayment = (bill) => {
    Alert.alert(
      'Desfazer Pagamento',
      `Reabrir "${bill.description}"?\n\nA despesa gerada será removida.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desfazer',
          style: 'destructive',
          onPress: async () => {
            await unmarkBillAsPaid(bill.id, selectedMonth, selectedYear);
            await loadBills();
          },
        },
      ]
    );
  };

  const handleDelete = (bill) => {
    const recurringWarning =
      bill.billType === 'fixa'
        ? '\n\nA conta some de todos os meses. As despesas já lançadas continuam no histórico.'
        : '';

    Alert.alert('Excluir Conta', `Deseja excluir "${bill.description}"?${recurringWarning}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteBill(bill.id);
          await loadBills();
        },
      },
    ]);
  };

  const openActions = (bill) => {
    Alert.alert(bill.description, 'O que deseja fazer?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Editar', onPress: () => navigation.navigate('AddBill', { bill }) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDelete(bill) },
    ]);
  };

  const changeMonth = (delta) => {
    const { month, year } = addMonths(selectedMonth, selectedYear, delta);
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.billButton}
          onPress={() => navigation.navigate('AddBill')}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={r.font(20)} color="#fff" />
          <Text style={styles.addButtonText}>Nova Conta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.transactionButton}
          onPress={() => navigation.navigate('AddTransactionBills')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={r.font(20)} color="#fff" />
          <Text style={styles.addButtonText}>Receita</Text>
        </TouchableOpacity>
      </View>

      <SearchBar
        onSearch={setSearchQuery}
        placeholder="Buscar contas..."
        containerStyle={styles.searchBar}
      />

      <View style={styles.monthNavigator}>
        <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(-1)}>
          <Ionicons name="chevron-back" size={r.font(22)} color={theme.primary} />
        </TouchableOpacity>

        <View style={styles.monthDisplay}>
          <Text style={styles.monthYearText}>{getMonthLabel(selectedMonth, selectedYear)}</Text>
        </View>

        <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(1)}>
          <Ionicons name="chevron-forward" size={r.font(22)} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryContainer}>
        <TouchableOpacity
          style={[
            styles.summaryItem,
            { borderBottomColor: theme.warning },
            statusFilter === 'all' && { backgroundColor: theme.warning + '15' },
          ]}
          onPress={() => toggleStatusFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatCurrency(monthSummary.total)}
          </Text>
          <Text style={styles.summaryCount}>{filteredBills.length} contas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.summaryItem,
            { borderBottomColor: theme.success },
            statusFilter === 'paid' && { backgroundColor: theme.success + '15' },
          ]}
          onPress={() => toggleStatusFilter('paid')}
          activeOpacity={0.7}
        >
          <Text style={styles.summaryLabel}>Pagas</Text>
          <Text style={[styles.summaryValue, { color: theme.success }]}>
            {formatCurrency(monthSummary.paid)}
          </Text>
          <Text style={styles.summaryCount}>{monthSummary.paidCount} contas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.summaryItem,
            { borderBottomColor: theme.error },
            statusFilter === 'pending' && { backgroundColor: theme.error + '15' },
          ]}
          onPress={() => toggleStatusFilter('pending')}
          activeOpacity={0.7}
        >
          <Text style={styles.summaryLabel}>Pendentes</Text>
          <Text style={[styles.summaryValue, { color: theme.error }]}>
            {formatCurrency(monthSummary.pending)}
          </Text>
          <Text style={styles.summaryCount}>{monthSummary.pendingCount} contas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.billsList} showsVerticalScrollIndicator={false}>
        {visibleBills.length > 0 ? (
          <View style={styles.billsGrid}>{visibleBills.map(bill => {
            const isPaid = isBillPaidForMonth(bill, selectedMonth, selectedYear);
            const status = getBillStatus(bill, selectedMonth, selectedYear);

            return (
              <TouchableOpacity
                key={bill.id}
                style={[styles.billItem, isPaid && styles.billItemPaid]}
                onLongPress={() => openActions(bill)}
                activeOpacity={0.7}
              >
                <View style={styles.billLeft}>
                  <View
                    style={[
                      styles.billIcon,
                      { backgroundColor: isPaid ? theme.successLight : theme.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name={
                        isPaid
                          ? 'checkmark-circle'
                          : BILL_CATEGORY_ICONS[bill.category] || 'document-text'
                      }
                      size={r.font(22)}
                      color={isPaid ? theme.success : theme.primary}
                    />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={[styles.billDescription, isPaid && styles.billDescriptionPaid]}>
                      {bill.description}
                    </Text>
                    <View style={styles.billMeta}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.billCategory}>{bill.category}</Text>
                      </View>
                      <Text style={styles.billDay}>Dia {bill.dueDay}</Text>
                      {bill.billType === 'fixa' && (
                        <Ionicons name="repeat" size={r.font(12)} color={theme.textSecondary} />
                      )}
                    </View>
                    <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                  </View>
                </View>

                <View style={styles.billActions}>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.billStatus, { color: status.color }]}>{status.text}</Text>
                  </View>
                  <View style={styles.actionButtons}>
                    {isPaid ? (
                      <TouchableOpacity
                        style={styles.undoButton}
                        onPress={() => confirmUndoPayment(bill)}
                      >
                        <Ionicons name="arrow-undo" size={r.font(16)} color={theme.textSecondary} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.payButton}
                        onPress={() => confirmMarkAsPaid(bill)}
                      >
                        <Ionicons name="checkmark" size={r.font(18)} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={() => openActions(bill)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={r.font(18)}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}</View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={r.font(64)} color={theme.border} />
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Nenhuma conta encontrada'
                : statusFilter !== 'all'
                ? `Nenhuma conta ${statusFilter === 'paid' ? 'paga' : 'pendente'}`
                : 'Nenhuma conta neste mês'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? 'Tente outro termo de busca'
                : statusFilter !== 'all'
                ? 'Toque no card novamente para ver todas'
                : 'Adicione uma conta para começar a controlar'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: r.space(16),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: r.space(12),
    marginBottom: r.space(16),
  },
  billButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: r.space(14),
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
    paddingVertical: r.space(14),
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
    fontSize: r.font(14),
    fontWeight: 'bold',
    marginLeft: r.space(8),
  },
  searchBar: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: r.space(16),
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: r.space(14),
    marginBottom: r.space(16),
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  navButton: {
    padding: r.space(6),
    borderRadius: 8,
    backgroundColor: theme.primaryLight,
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthYearText: {
    color: theme.text,
    fontSize: r.font(17),
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: r.space(10),
    marginBottom: r.space(16),
  },
  summaryItem: {
    flex: 1,
    backgroundColor: theme.card,
    padding: r.space(12),
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
    fontSize: r.font(11),
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: r.font(14),
    fontWeight: 'bold',
    marginTop: r.space(4),
  },
  summaryCount: {
    fontSize: r.font(10),
    color: theme.textSecondary,
    marginTop: r.space(2),
  },
  billsList: {
    flex: 1,
  },
  billItem: {
    width: gridItemWidth(r.listColumns),
    backgroundColor: theme.card,
    padding: r.space(16),
    borderRadius: 14,
    marginBottom: r.space(10),
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
    marginRight: r.space(14),
  },
  billInfo: {
    flex: 1,
  },
  billDescription: {
    fontSize: r.font(15),
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
    marginTop: r.space(5),
    gap: r.space(8),
  },
  categoryBadge: {
    backgroundColor: theme.primaryLight,
    paddingHorizontal: r.space(8),
    paddingVertical: r.space(2),
    borderRadius: 6,
  },
  billCategory: {
    fontSize: r.font(11),
    color: theme.primary,
    fontWeight: '600',
  },
  billDay: {
    fontSize: r.font(11),
    color: theme.textSecondary,
  },
  billAmount: {
    fontSize: r.font(14),
    color: theme.primary,
    marginTop: r.space(4),
    fontWeight: '700',
  },
  billActions: {
    alignItems: 'flex-end',
    gap: r.space(8),
  },
  statusBadge: {
    paddingHorizontal: r.space(10),
    paddingVertical: r.space(4),
    borderRadius: 8,
  },
  billStatus: {
    fontSize: r.font(11),
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(8),
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
  undoButton: {
    backgroundColor: theme.inputBg,
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  moreButton: {
    padding: r.space(4),
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: r.space(60),
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: r.font(17),
    textAlign: 'center',
    marginTop: r.space(16),
    fontWeight: '600',
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: r.font(14),
    textAlign: 'center',
    marginTop: r.space(6),
    opacity: 0.7,
  },
  billsGrid: {
    ...gridContainer(r.listColumns),
  },
});

export default BillsScreen;

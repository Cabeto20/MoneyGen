import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import {
  getBalance,
  getBills,
  markBillAsPaid,
  getBudgetStatus,
  getGoals,
  getAccountBalances,
} from '../database/database';
import {
  getBillStatus,
  filterBillsByMonth,
  isBillPaidForMonth,
  getPendingBillsTotal,
} from '../utils/billHelpers';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive, gridContainer, gridItemWidth } from '../utils/responsive';
import SearchBar from './SearchBar';
import { BILL_CATEGORY_ICONS, getCategoryColor, getCategoryIconName } from '../utils/categories';

const HomeScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const [balance, setBalance] = useState({ income: 0, expense: 0, balance: 0 });
  const [bills, setBills] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const styles = createStyles(theme, r);
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const loadData = useCallback(async () => {
    const [bal, billsData, budgetsData, goalsData, accountsData] = await Promise.all([
      getBalance(),
      getBills(),
      getBudgetStatus(),
      getGoals(),
      getAccountBalances(),
    ]);

    setBalance(bal);
    setBills(billsData);
    setBudgets(budgetsData);
    setGoals(goalsData);
    setAccounts(accountsData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const currentMonthBills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const source = query
      ? bills.filter(bill => bill.description.toLowerCase().includes(query))
      : bills;

    return filterBillsByMonth(source, currentMonth, currentYear)
      .filter(bill => !isBillPaidForMonth(bill, currentMonth, currentYear))
      .slice(0, 5);
  }, [bills, searchQuery, currentMonth, currentYear]);

  const pendingTotal = useMemo(
    () => getPendingBillsTotal(bills, currentMonth, currentYear),
    [bills, currentMonth, currentYear]
  );

  const budgetAlerts = useMemo(
    () => budgets.filter(budget => budget.status !== 'ok').slice(0, 3),
    [budgets]
  );

  const activeGoals = useMemo(
    () => goals.filter(goal => (goal.savedAmount || 0) < goal.targetAmount).slice(0, 2),
    [goals]
  );

  const confirmMarkAsPaid = (bill) => {
    Alert.alert(
      'Marcar como Paga',
      `Confirma pagamento de "${bill.description}" (${formatCurrency(bill.amount)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await markBillAsPaid(bill.id, currentMonth, currentYear);
            await loadData();
          },
        },
      ]
    );
  };

  const getBalanceColor = () => {
    if (balance.balance > 0) return theme.success;
    if (balance.balance < 0) return theme.error;
    return theme.text;
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SearchBar onSearch={setSearchQuery} placeholder="Buscar contas..." />

        {/* Saldo */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet-outline" size={r.font(22)} color={theme.primary} />
            <Text style={styles.balanceLabel}>Saldo Total</Text>
            {accounts.length > 1 && (
              <TouchableOpacity onPress={() => navigation.navigate('Accounts')}>
                <Text style={styles.balanceLink}>{accounts.length} carteiras</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.balanceAmount, { color: getBalanceColor() }]}>
            {formatCurrency(balance.balance)}
          </Text>

          {pendingTotal > 0 && (
            <Text style={styles.balanceProjection}>
              {formatCurrency(balance.balance - pendingTotal)} após pagar as contas do mês
            </Text>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.successLight }]}>
                <Ionicons name="arrow-down" size={r.font(16)} color={theme.success} />
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
                <Ionicons name="arrow-up" size={r.font(16)} color={theme.error} />
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

        {/* Atalhos */}
        <View style={styles.quickStats}>
          <QuickAction
            icon="swap-horizontal"
            color={theme.primary}
            label="Transações"
            onPress={() => navigation.navigate('Transactions')}
            styles={styles}
          />
          <QuickAction
            icon="calendar"
            color={theme.warning}
            label="Contas"
            onPress={() => navigation.navigate('Bills')}
            styles={styles}
          />
          <QuickAction
            icon="stats-chart"
            color={theme.success}
            label="Relatórios"
            onPress={() => navigation.navigate('Stats')}
            styles={styles}
          />
        </View>

        <View style={styles.quickStats}>
          <QuickAction
            icon="layers"
            color={theme.primary}
            label="Planejamento"
            onPress={() => navigation.navigate('Planning')}
            styles={styles}
          />
        </View>

        {/* Alertas de orçamento */}
        {budgetAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={r.font(20)} color={theme.warning} />
              <Text style={styles.sectionTitle}>Atenção no orçamento</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Budgets')}>
                <Text style={styles.sectionAction}>ver todos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.alertsGrid}>{budgetAlerts.map(budget => {
              const exceeded = budget.status === 'exceeded';
              const color = exceeded ? theme.error : theme.warning;

              return (
                <TouchableOpacity
                  key={budget.category}
                  style={styles.alertItem}
                  onPress={() => navigation.navigate('Budgets')}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.alertIcon,
                      { backgroundColor: getCategoryColor(budget.category) + '20' },
                    ]}
                  >
                    <Ionicons
                      name={getCategoryIconName(budget.category)}
                      size={r.font(18)}
                      color={getCategoryColor(budget.category)}
                    />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertTitle}>{budget.category}</Text>
                    <View style={styles.alertTrack}>
                      <View
                        style={[
                          styles.alertFill,
                          {
                            width: `${Math.min(budget.percent * 100, 100)}%`,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.alertRight}>
                    <Text style={[styles.alertPercent, { color }]}>
                      {(budget.percent * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.alertHint}>
                      {exceeded
                        ? `+${formatCurrency(Math.abs(budget.remaining))}`
                        : formatCurrency(budget.remaining)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}</View>
          </View>
        )}

        {/* Metas */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flag-outline" size={r.font(20)} color={theme.primary} />
              <Text style={styles.sectionTitle}>Suas metas</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Goals')}>
                <Text style={styles.sectionAction}>ver todas</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.alertsGrid}>{activeGoals.map(goal => {
              const saved = goal.savedAmount || 0;
              const percent = goal.targetAmount > 0 ? saved / goal.targetAmount : 0;

              return (
                <TouchableOpacity
                  key={goal.id}
                  style={styles.alertItem}
                  onPress={() => navigation.navigate('Goals')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.alertIcon, { backgroundColor: goal.color + '20' }]}>
                    <Ionicons name={goal.icon} size={r.font(18)} color={goal.color} />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertTitle}>{goal.name}</Text>
                    <View style={styles.alertTrack}>
                      <View
                        style={[
                          styles.alertFill,
                          {
                            width: `${Math.min(percent * 100, 100)}%`,
                            backgroundColor: goal.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.alertRight}>
                    <Text style={[styles.alertPercent, { color: goal.color }]}>
                      {(percent * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.alertHint}>{formatCurrency(saved)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}</View>
          </View>
        )}

        {/* Contas do mês */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle-outline" size={r.font(20)} color={theme.warning} />
            <Text style={styles.sectionTitle}>Contas do Mês</Text>
            <Text style={styles.sectionCount}>{currentMonthBills.length}</Text>
          </View>

          {currentMonthBills.length > 0 ? (
            <View style={styles.billsGrid}>{currentMonthBills.map(bill => {
              const status = getBillStatus(bill, currentMonth, currentYear);
              return (
                <View key={bill.id} style={styles.billItem}>
                  <View style={[styles.billIcon, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons
                      name={BILL_CATEGORY_ICONS[bill.category] || 'document-text'}
                      size={r.font(20)}
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
                      <Ionicons name="checkmark" size={r.font(16)} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}</View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={r.font(48)} color={theme.success} />
              <Text style={styles.emptyText}>Tudo em dia!</Text>
              <Text style={styles.emptySubtext}>Nenhuma conta pendente este mês</Text>
            </View>
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
};

const QuickAction = ({ icon, color, label, onPress, styles }) => {
  const r = useResponsive();

  return (
    <Pressable
      style={({ pressed }) => [styles.quickStatCard, pressed && styles.quickStatCardPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={r.font(24)} color={color} />
      <Text style={styles.quickStatLabel}>{label}</Text>
    </Pressable>
  );
};

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  balanceCard: {
    backgroundColor: theme.card,
    padding: r.space(24),
    borderRadius: 20,
    marginHorizontal: r.space(16),
    marginBottom: r.space(16),
    elevation: 4,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(8),
    marginBottom: r.space(8),
  },
  balanceLabel: {
    fontSize: r.font(15),
    color: theme.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  balanceLink: {
    fontSize: r.font(12),
    color: theme.primary,
    fontWeight: '700',
  },
  balanceAmount: {
    fontSize: r.font(36),
    fontWeight: '800',
    textAlign: 'left',
    marginVertical: r.space(8),
    letterSpacing: -1,
  },
  balanceProjection: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    marginTop: -4,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: r.space(16),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(10),
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: r.font(15),
    fontWeight: 'bold',
    marginTop: r.space(2),
  },
  quickStats: {
    flexDirection: 'row',
    marginHorizontal: r.space(16),
    marginBottom: r.space(12),
    gap: r.space(10),
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: theme.card,
    padding: r.space(16),
    borderRadius: 14,
    alignItems: 'center',
    gap: r.space(8),
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  quickStatCardPressed: {
    opacity: 0.7,
  },
  quickStatLabel: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    fontWeight: '600',
  },
  section: {
    marginTop: r.space(10),
    marginBottom: r.space(12),
    paddingHorizontal: r.space(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: r.space(14),
    gap: r.space(8),
  },
  sectionTitle: {
    fontSize: r.font(18),
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  sectionAction: {
    fontSize: r.font(12),
    color: theme.primary,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: r.font(13),
    fontWeight: '700',
    color: theme.primary,
    backgroundColor: theme.primaryLight,
    paddingHorizontal: r.space(10),
    paddingVertical: r.space(3),
    borderRadius: 8,
    overflow: 'hidden',
  },
  alertItem: {
    width: gridItemWidth(r.listColumns),
    backgroundColor: theme.card,
    padding: r.space(14),
    borderRadius: 14,
    marginBottom: r.space(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(12),
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertInfo: {
    flex: 1,
    gap: r.space(7),
  },
  alertTitle: {
    fontSize: r.font(14),
    color: theme.text,
    fontWeight: '600',
  },
  alertTrack: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  alertFill: {
    height: '100%',
    borderRadius: 3,
  },
  alertRight: {
    alignItems: 'flex-end',
  },
  alertPercent: {
    fontSize: r.font(14),
    fontWeight: '800',
  },
  alertHint: {
    fontSize: r.font(10),
    color: theme.textSecondary,
    marginTop: r.space(2),
  },
  billItem: {
    width: gridItemWidth(r.listColumns),
    backgroundColor: theme.card,
    padding: r.space(16),
    borderRadius: 14,
    marginBottom: r.space(10),
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
  billMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: r.space(6),
    gap: r.space(6),
  },
  billAmount: {
    fontSize: r.font(13),
    color: theme.primary,
    fontWeight: '700',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  billStatus: {
    fontSize: r.font(12),
    fontWeight: '600',
  },
  billActions: {
    alignItems: 'center',
    gap: r.space(6),
  },
  billDay: {
    fontSize: r.font(11),
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
    paddingVertical: r.space(32),
    backgroundColor: theme.card,
    borderRadius: 14,
    elevation: 1,
  },
  emptyText: {
    color: theme.text,
    fontSize: r.font(17),
    fontWeight: '600',
    marginTop: r.space(12),
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: r.font(14),
    marginTop: r.space(4),
  },
  alertsGrid: {
    ...gridContainer(r.listColumns),
  },
  billsGrid: {
    ...gridContainer(r.listColumns),
  },
});

export default HomeScreen;

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import {
  getTransactionsByCategory,
  getMonthlyStats,
  getBalance,
  getBills,
  getBudgetStatus,
} from '../database/database';
import { filterBillsByMonth, isBillPaidForMonth } from '../utils/billHelpers';
import { getShortMonthLabel } from '../utils/dateHelpers';
import { useTheme } from '../contexts/ThemeContext';
import { getCategoryColor, getCategoryIconName } from '../utils/categories';
import DonutChart from './DonutChart';

const StatsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [categories, setCategories] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [balance, setBalance] = useState({ income: 0, expense: 0, balance: 0 });
  const [bills, setBills] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [activeTab, setActiveTab] = useState('categories');
  const [scope, setScope] = useState('month');

  const styles = createStyles(theme);
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const loadData = useCallback(async () => {
    const [cats, monthly, bal, billsData, budgetsData] = await Promise.all([
      scope === 'month'
        ? getTransactionsByCategory(currentMonth, currentYear)
        : getTransactionsByCategory(),
      getMonthlyStats(),
      getBalance(),
      getBills(),
      getBudgetStatus(currentMonth, currentYear),
    ]);

    setCategories(cats);
    setMonthlyStats(monthly);
    setBalance(bal);
    setBills(billsData);
    setBudgets(budgetsData);
  }, [scope, currentMonth, currentYear]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totalExpenses = useMemo(
    () => categories.reduce((sum, c) => sum + c.total, 0),
    [categories]
  );

  /** Fatias do donut: as maiores em destaque, o resto agrupado em "Outras". */
  const chartData = useMemo(() => {
    const TOP = 6;
    const top = categories.slice(0, TOP).map((cat, index) => ({
      name: cat.name,
      value: cat.total,
      color: getCategoryColor(cat.name, index),
    }));

    const rest = categories.slice(TOP);
    if (rest.length > 0) {
      top.push({
        name: 'Outras',
        value: rest.reduce((sum, cat) => sum + cat.total, 0),
        color: theme.textSecondary,
      });
    }

    return top;
  }, [categories, theme]);

  const billsSummary = useMemo(() => {
    const monthBills = filterBillsByMonth(bills, currentMonth, currentYear);
    const paid = monthBills.filter(bill => isBillPaidForMonth(bill, currentMonth, currentYear));
    const pending = monthBills.filter(bill => !isBillPaidForMonth(bill, currentMonth, currentYear));

    return {
      total: monthBills.length,
      paid: paid.length,
      pending: pending.length,
      paidAmount: paid.reduce((s, b) => s + b.amount, 0),
      pendingAmount: pending.reduce((s, b) => s + b.amount, 0),
    };
  }, [bills, currentMonth, currentYear]);

  const budgetSummary = useMemo(() => {
    if (budgets.length === 0) return null;

    const limit = budgets.reduce((sum, b) => sum + b.limit, 0);
    const spent = budgets.reduce((sum, b) => sum + b.spent, 0);
    return {
      limit,
      spent,
      percent: limit > 0 ? spent / limit : 0,
      exceeded: budgets.filter(b => b.status === 'exceeded').length,
    };
  }, [budgets]);

  const maxMonthlyValue = useMemo(() => {
    if (monthlyStats.length === 0) return 1;
    return Math.max(...monthlyStats.map(m => Math.max(m.income, m.expense))) || 1;
  }, [monthlyStats]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { borderLeftColor: theme.success }]}>
          <Ionicons name="trending-up" size={20} color={theme.success} />
          <Text style={styles.overviewLabel}>Receitas</Text>
          <Text style={[styles.overviewValue, { color: theme.success }]}>
            {formatCurrency(balance.income)}
          </Text>
        </View>
        <View style={[styles.overviewCard, { borderLeftColor: theme.error }]}>
          <Ionicons name="trending-down" size={20} color={theme.error} />
          <Text style={styles.overviewLabel}>Despesas</Text>
          <Text style={[styles.overviewValue, { color: theme.error }]}>
            {formatCurrency(balance.expense)}
          </Text>
        </View>
      </View>

      {/* Contas do mês */}
      <View style={styles.billsCard}>
        <View style={styles.billsHeader}>
          <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          <Text style={styles.billsTitle}>Contas do Mês</Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    billsSummary.total > 0
                      ? `${(billsSummary.paid / billsSummary.total) * 100}%`
                      : '0%',
                  backgroundColor: theme.success,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {billsSummary.paid}/{billsSummary.total} pagas
          </Text>
        </View>

        <View style={styles.billsStatsRow}>
          <View style={styles.billsStat}>
            <Text style={[styles.billsStatValue, { color: theme.success }]}>
              {formatCurrency(billsSummary.paidAmount)}
            </Text>
            <Text style={styles.billsStatLabel}>Pagas</Text>
          </View>
          <View style={styles.billsStatDivider} />
          <View style={styles.billsStat}>
            <Text style={[styles.billsStatValue, { color: theme.error }]}>
              {formatCurrency(billsSummary.pendingAmount)}
            </Text>
            <Text style={styles.billsStatLabel}>Pendentes</Text>
          </View>
        </View>
      </View>

      {/* Orçamento */}
      {!!budgetSummary && (
        <TouchableOpacity
          style={styles.billsCard}
          onPress={() => navigation.navigate('Budgets')}
          activeOpacity={0.8}
        >
          <View style={styles.billsHeader}>
            <Ionicons name="pie-chart-outline" size={20} color={theme.primary} />
            <Text style={styles.billsTitle}>Orçamento do Mês</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(budgetSummary.percent * 100, 100)}%`,
                    backgroundColor:
                      budgetSummary.percent >= 1 ? theme.error : theme.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {formatCurrency(budgetSummary.spent)} de {formatCurrency(budgetSummary.limit)}
              {budgetSummary.exceeded > 0 &&
                ` · ${budgetSummary.exceeded} estourado${budgetSummary.exceeded > 1 ? 's' : ''}`}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Abas */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'categories' && styles.activeTab]}
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.activeTabText]}>
            Por Categoria
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'monthly' && styles.activeTab]}
          onPress={() => setActiveTab('monthly')}
        >
          <Text style={[styles.tabText, activeTab === 'monthly' && styles.activeTabText]}>
            Por Mês
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'categories' && (
        <View style={styles.section}>
          <View style={styles.scopeRow}>
            {[
              { key: 'month', label: 'Este mês' },
              { key: 'all', label: 'Todo período' },
            ].map(item => (
              <TouchableOpacity
                key={item.key}
                style={[styles.scopeButton, scope === item.key && styles.scopeButtonActive]}
                onPress={() => setScope(item.key)}
              >
                <Text
                  style={[styles.scopeText, scope === item.key && styles.scopeTextActive]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {categories.length > 0 ? (
            <>
              <View style={styles.chartCard}>
                <DonutChart
                  data={chartData}
                  theme={theme}
                  size={198}
                  strokeWidth={28}
                  centerValue={formatCurrency(totalExpenses)}
                  centerLabel={scope === 'month' ? 'Gasto no mês' : 'Gasto total'}
                />

                <View style={styles.legend}>
                  {chartData.map(slice => (
                    <View key={slice.name} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {slice.name}
                      </Text>
                      <Text style={styles.legendValue}>
                        {totalExpenses > 0
                          ? `${((slice.value / totalExpenses) * 100).toFixed(0)}%`
                          : '0%'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {categories.map((cat, index) => {
                const percentage = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                const color = getCategoryColor(cat.name, index);

                return (
                  <View key={cat.name} style={styles.categoryItem}>
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryIcon, { backgroundColor: color + '20' }]}>
                        <Ionicons name={getCategoryIconName(cat.name)} size={20} color={color} />
                      </View>
                      <View style={styles.categoryInfo}>
                        <View style={styles.categoryHeader}>
                          <Text style={styles.categoryName}>{cat.name}</Text>
                          <Text style={styles.categoryAmount}>{formatCurrency(cat.total)}</Text>
                        </View>
                        <View style={styles.categoryBarContainer}>
                          <View
                            style={[
                              styles.categoryBar,
                              { width: `${percentage}%`, backgroundColor: color },
                            ]}
                          />
                        </View>
                        <View style={styles.categoryFooter}>
                          <Text style={styles.categoryPercent}>{percentage.toFixed(1)}%</Text>
                          <Text style={styles.categoryCount}>{cat.count} transações</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="pie-chart-outline" size={64} color={theme.border} />
              <Text style={styles.emptyText}>Sem dados de despesas</Text>
              <Text style={styles.emptySubtext}>
                {scope === 'month'
                  ? 'Nenhuma despesa registrada neste mês'
                  : 'Adicione despesas para ver as estatísticas'}
              </Text>
            </View>
          )}
        </View>
      )}

      {activeTab === 'monthly' && (
        <View style={styles.section}>
          {monthlyStats.length > 0 ? (
            monthlyStats.map(month => (
              <View key={month.key} style={styles.monthItem}>
                <Text style={styles.monthName}>
                  {getShortMonthLabel(month.month, month.year)}/{String(month.year).slice(-2)}
                </Text>

                <View style={styles.monthBars}>
                  <View style={styles.monthBarRow}>
                    <Ionicons name="arrow-down" size={14} color={theme.success} />
                    <View style={styles.monthBarContainer}>
                      <View
                        style={[
                          styles.monthBar,
                          {
                            width: `${(month.income / maxMonthlyValue) * 100}%`,
                            backgroundColor: theme.success,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.monthBarValue, { color: theme.success }]}>
                      {formatCurrency(month.income)}
                    </Text>
                  </View>

                  <View style={styles.monthBarRow}>
                    <Ionicons name="arrow-up" size={14} color={theme.error} />
                    <View style={styles.monthBarContainer}>
                      <View
                        style={[
                          styles.monthBar,
                          {
                            width: `${(month.expense / maxMonthlyValue) * 100}%`,
                            backgroundColor: theme.error,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.monthBarValue, { color: theme.error }]}>
                      {formatCurrency(month.expense)}
                    </Text>
                  </View>
                </View>

                <View style={styles.monthBalance}>
                  <Text
                    style={[
                      styles.monthBalanceValue,
                      {
                        color:
                          month.income - month.expense >= 0 ? theme.success : theme.error,
                      },
                    ]}
                  >
                    {month.income - month.expense >= 0 ? '+' : ''}
                    {formatCurrency(month.income - month.expense)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={64} color={theme.border} />
              <Text style={styles.emptyText}>Sem dados mensais</Text>
              <Text style={styles.emptySubtext}>Adicione transações para ver o histórico</Text>
            </View>
          )}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    gap: 6,
  },
  overviewLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  billsCard: {
    backgroundColor: theme.card,
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  billsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  billsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    flex: 1,
  },
  progressBarContainer: {
    gap: 6,
    marginBottom: 14,
  },
  progressBar: {
    height: 10,
    backgroundColor: theme.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  billsStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billsStat: {
    flex: 1,
    alignItems: 'center',
  },
  billsStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  billsStatLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  billsStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.border,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    elevation: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: theme.primary,
  },
  tabText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  section: {
    marginBottom: 16,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  scopeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  scopeButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  scopeText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  scopeTextActive: {
    color: '#fff',
  },
  chartCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  legend: {
    width: '100%',
    marginTop: 18,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: theme.text,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  categoryItem: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '600',
  },
  categoryAmount: {
    fontSize: 15,
    color: theme.text,
    fontWeight: 'bold',
  },
  categoryBarContainer: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 3,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  categoryPercent: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  monthItem: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  monthName: {
    fontSize: 15,
    color: theme.text,
    fontWeight: 'bold',
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  monthBars: {
    gap: 10,
  },
  monthBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  monthBar: {
    height: '100%',
    borderRadius: 4,
  },
  monthBarValue: {
    fontSize: 12,
    fontWeight: '600',
    width: 90,
    textAlign: 'right',
  },
  monthBalance: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    alignItems: 'flex-end',
  },
  monthBalanceValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: theme.card,
    borderRadius: 14,
  },
  emptyText: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 14,
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

export default StatsScreen;

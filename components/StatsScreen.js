import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getTransactionsByCategory, getMonthlyStats, getBalance, getBills } from '../database/database';
import { filterBillsByMonth } from '../utils/billHelpers';
import { useTheme } from '../contexts/ThemeContext';

const CATEGORY_COLORS = {
  'Alimentação': '#ef4444',
  'Transporte': '#3b82f6',
  'Moradia': '#8b5cf6',
  'Saúde': '#10b981',
  'Educação': '#f59e0b',
  'Lazer': '#ec4899',
  'Compras': '#f97316',
  'Serviços': '#6366f1',
};

const CATEGORY_ICONS = {
  'Alimentação': 'fast-food',
  'Transporte': 'car',
  'Moradia': 'home',
  'Saúde': 'medkit',
  'Educação': 'school',
  'Lazer': 'game-controller',
  'Compras': 'bag-handle',
  'Serviços': 'construct',
};

const StatsScreen = () => {
  const { theme } = useTheme();
  const [categories, setCategories] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [balance, setBalance] = useState({ income: 0, expense: 0, balance: 0 });
  const [bills, setBills] = useState([]);
  const [activeTab, setActiveTab] = useState('categories');

  const styles = createStyles(theme);

  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        const cats = await getTransactionsByCategory();
        const monthly = await getMonthlyStats();
        const bal = await getBalance();
        const billsData = await getBills();
        setCategories(cats);
        setMonthlyStats(monthly);
        setBalance(bal);
        setBills(billsData);
      };
      loadData();
    }, [])
  );

  const totalExpenses = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.total, 0);
  }, [categories]);

  const billsSummary = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthBills = filterBillsByMonth(bills, currentMonth, currentYear);
    const paid = monthBills.filter(b => b.isPaid);
    const pending = monthBills.filter(b => !b.isPaid);
    return {
      total: monthBills.length,
      paid: paid.length,
      pending: pending.length,
      paidAmount: paid.reduce((s, b) => s + b.amount, 0),
      pendingAmount: pending.reduce((s, b) => s + b.amount, 0),
    };
  }, [bills]);

  const getMonthName = (monthStr) => {
    const [month, year] = monthStr.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  };

  const maxMonthlyValue = useMemo(() => {
    if (monthlyStats.length === 0) return 1;
    return Math.max(...monthlyStats.map(m => Math.max(m.income, m.expense)));
  }, [monthlyStats]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overview Cards */}
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

      {/* Bills Progress */}
      <View style={styles.billsCard}>
        <View style={styles.billsHeader}>
          <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          <Text style={styles.billsTitle}>Contas do Mês</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill, 
              { 
                width: billsSummary.total > 0 
                  ? `${(billsSummary.paid / billsSummary.total) * 100}%` 
                  : '0%',
                backgroundColor: theme.success,
              }
            ]} />
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

      {/* Tab Selector */}
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

      {/* Categories View */}
      {activeTab === 'categories' && (
        <View style={styles.section}>
          {categories.length > 0 ? (
            categories.map((cat, index) => {
              const percentage = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
              const color = CATEGORY_COLORS[cat.name] || theme.primary;
              const icon = CATEGORY_ICONS[cat.name] || 'ellipse';
              
              return (
                <View key={cat.name} style={styles.categoryItem}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryIcon, { backgroundColor: color + '20' }]}>
                      <Ionicons name={icon} size={20} color={color} />
                    </View>
                    <View style={styles.categoryInfo}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <Text style={styles.categoryAmount}>{formatCurrency(cat.total)}</Text>
                      </View>
                      <View style={styles.categoryBarContainer}>
                        <View style={[styles.categoryBar, { width: `${percentage}%`, backgroundColor: color }]} />
                      </View>
                      <View style={styles.categoryFooter}>
                        <Text style={styles.categoryPercent}>{percentage.toFixed(1)}%</Text>
                        <Text style={styles.categoryCount}>{cat.count} transações</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="pie-chart-outline" size={64} color={theme.border} />
              <Text style={styles.emptyText}>Sem dados de despesas</Text>
              <Text style={styles.emptySubtext}>Adicione despesas para ver as estatísticas</Text>
            </View>
          )}
        </View>
      )}

      {/* Monthly View */}
      {activeTab === 'monthly' && (
        <View style={styles.section}>
          {monthlyStats.length > 0 ? (
            monthlyStats.map((month) => (
              <View key={month.month} style={styles.monthItem}>
                <Text style={styles.monthName}>{getMonthName(month.month)}</Text>
                
                <View style={styles.monthBars}>
                  <View style={styles.monthBarRow}>
                    <Ionicons name="arrow-down" size={14} color={theme.success} />
                    <View style={styles.monthBarContainer}>
                      <View style={[
                        styles.monthBar,
                        { 
                          width: `${(month.income / maxMonthlyValue) * 100}%`,
                          backgroundColor: theme.success,
                        }
                      ]} />
                    </View>
                    <Text style={[styles.monthBarValue, { color: theme.success }]}>
                      {formatCurrency(month.income)}
                    </Text>
                  </View>
                  
                  <View style={styles.monthBarRow}>
                    <Ionicons name="arrow-up" size={14} color={theme.error} />
                    <View style={styles.monthBarContainer}>
                      <View style={[
                        styles.monthBar,
                        { 
                          width: `${(month.expense / maxMonthlyValue) * 100}%`,
                          backgroundColor: theme.error,
                        }
                      ]} />
                    </View>
                    <Text style={[styles.monthBarValue, { color: theme.error }]}>
                      {formatCurrency(month.expense)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.monthBalance}>
                  <Text style={[
                    styles.monthBalanceValue,
                    { color: month.income - month.expense >= 0 ? theme.success : theme.error }
                  ]}>
                    {month.income - month.expense >= 0 ? '+' : ''}{formatCurrency(month.income - month.expense)}
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
  billsStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.border,
  },
  billsStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  billsStatLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
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
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
  section: {},
  categoryItem: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    fontWeight: '600',
    color: theme.text,
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.text,
  },
  categoryBarContainer: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  categoryBar: {
    height: '100%',
    borderRadius: 4,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
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
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  monthName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  monthBars: {
    gap: 8,
  },
  monthBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: theme.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  monthBar: {
    height: '100%',
    borderRadius: 6,
    minWidth: 4,
  },
  monthBarValue: {
    fontSize: 12,
    fontWeight: '700',
    width: 90,
    textAlign: 'right',
  },
  monthBalance: {
    marginTop: 10,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 8,
  },
  monthBalanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: theme.card,
    borderRadius: 14,
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 6,
    opacity: 0.7,
  },
});

export default StatsScreen;

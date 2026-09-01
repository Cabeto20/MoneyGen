import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getTransactions, deleteTransaction, getAccounts } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive, gridContainer, gridItemWidth } from '../utils/responsive';
import { TRANSACTION_CATEGORY_ICONS as CATEGORY_ICONS } from '../utils/categories';
import { getTransactionDate, isSameMonth, addMonths, getMonthLabel } from '../utils/dateHelpers';
import SearchBar from './SearchBar';

const ALL = 'all';

const TransactionsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [typeFilter, setTypeFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [accountFilter, setAccountFilter] = useState(ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showFilters, setShowFilters] = useState(false);

  const styles = createStyles(theme, r);

  const loadData = useCallback(async () => {
    const [txs, accs] = await Promise.all([getTransactions(), getAccounts()]);
    setTransactions(txs);
    setAccounts(accs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const accountNames = useMemo(
    () => accounts.reduce((map, account) => ({ ...map, [account.id]: account.name }), {}),
    [accounts]
  );

  /** Categorias efetivamente usadas — evita chips vazios no filtro. */
  const usedCategories = useMemo(() => {
    const names = new Set();
    transactions.forEach(t => {
      if (t.category) names.add(t.category);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter(transaction => {
      if (typeFilter !== ALL && transaction.type !== typeFilter) return false;
      if (categoryFilter !== ALL && transaction.category !== categoryFilter) return false;
      if (accountFilter !== ALL && transaction.accountId !== accountFilter) return false;

      if (!showAllMonths) {
        const date = getTransactionDate(transaction);
        if (!isSameMonth(date, selectedMonth, selectedYear)) return false;
      }

      if (query) {
        const haystack = `${transaction.description} ${transaction.category || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    transactions,
    typeFilter,
    categoryFilter,
    accountFilter,
    showAllMonths,
    selectedMonth,
    selectedYear,
    searchQuery,
  ]);

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const activeFilterCount =
    (categoryFilter !== ALL ? 1 : 0) + (accountFilter !== ALL ? 1 : 0);

  const changeMonth = (delta) => {
    const { month, year } = addMonths(selectedMonth, selectedYear, delta);
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const handleEdit = (transaction) => {
    navigation.navigate(transaction.type === 'income' ? 'AddTransaction' : 'AddExpense', {
      transaction,
    });
  };

  const handleDelete = (transaction) => {
    const billWarning = transaction.billId
      ? '\n\nA conta correspondente voltará a ficar em aberto no mês.'
      : '';

    Alert.alert('Excluir Transação', `Deseja excluir "${transaction.description}"?${billWarning}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(transaction.id);
          await loadData();
        },
      },
    ]);
  };

  const openActions = (transaction) => {
    Alert.alert(transaction.description, 'O que deseja fazer?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Editar', onPress: () => handleEdit(transaction) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDelete(transaction) },
    ]);
  };

  const clearFilters = () => {
    setCategoryFilter(ALL);
    setAccountFilter(ALL);
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.incomeButton}
          onPress={() => navigation.navigate('AddTransaction')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={r.font(20)} color="#fff" />
          <Text style={styles.addButtonText}>Nova Receita</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.expenseButton}
          onPress={() => navigation.navigate('AddExpense')}
          activeOpacity={0.8}
        >
          <Ionicons name="remove-circle-outline" size={r.font(20)} color="#fff" />
          <Text style={styles.addButtonText}>Nova Despesa</Text>
        </TouchableOpacity>
      </View>

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

      <SearchBar
        onSearch={setSearchQuery}
        placeholder="Buscar transações..."
        containerStyle={styles.searchBar}
      />

      {/* Período */}
      <View style={styles.periodRow}>
        <TouchableOpacity
          style={[styles.navButton, showAllMonths && styles.navButtonDisabled]}
          onPress={() => changeMonth(-1)}
          disabled={showAllMonths}
        >
          <Ionicons
            name="chevron-back"
            size={r.font(20)}
            color={showAllMonths ? theme.border : theme.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.periodLabel}
          onPress={() => setShowAllMonths(!showAllMonths)}
        >
          <Text style={styles.periodText}>
            {showAllMonths ? 'Todo o período' : getMonthLabel(selectedMonth, selectedYear)}
          </Text>
          <Text style={styles.periodHint}>
            {showAllMonths ? 'toque para filtrar por mês' : 'toque para ver tudo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, showAllMonths && styles.navButtonDisabled]}
          onPress={() => changeMonth(1)}
          disabled={showAllMonths}
        >
          <Ionicons
            name="chevron-forward"
            size={r.font(20)}
            color={showAllMonths ? theme.border : theme.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Tipo */}
      <View style={styles.filterContainer}>
        {[
          { key: ALL, label: 'Todas' },
          { key: 'income', label: 'Receitas' },
          { key: 'expense', label: 'Despesas' },
        ].map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.filterButton, typeFilter === item.key && styles.activeFilter]}
            onPress={() => setTypeFilter(item.key)}
          >
            <Text style={[styles.filterText, typeFilter === item.key && styles.activeFilterText]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.filtersToggle}
        onPress={() => setShowFilters(!showFilters)}
        activeOpacity={0.7}
      >
        <Ionicons name="options-outline" size={r.font(16)} color={theme.primary} />
        <Text style={styles.filtersToggleText}>
          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Text>
        <Ionicons
          name={showFilters ? 'chevron-up' : 'chevron-down'}
          size={r.font(16)}
          color={theme.textSecondary}
        />
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={clearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearFiltersText}>limpar</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {showFilters && (
        <View style={styles.advancedFilters}>
          <Text style={styles.filterGroupLabel}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <FilterChip
                label="Todas"
                active={categoryFilter === ALL}
                onPress={() => setCategoryFilter(ALL)}
                styles={styles}
              />
              {usedCategories.map(category => (
                <FilterChip
                  key={category}
                  label={category}
                  icon={CATEGORY_ICONS[category]}
                  active={categoryFilter === category}
                  onPress={() => setCategoryFilter(category)}
                  styles={styles}
                  theme={theme}
                />
              ))}
            </View>
          </ScrollView>

          {accounts.length > 1 && (
            <>
              <Text style={[styles.filterGroupLabel, { marginTop: 14 }]}>Carteira</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <FilterChip
                    label="Todas"
                    active={accountFilter === ALL}
                    onPress={() => setAccountFilter(ALL)}
                    styles={styles}
                  />
                  {accounts.map(account => (
                    <FilterChip
                      key={account.id}
                      label={account.name}
                      active={accountFilter === account.id}
                      onPress={() => setAccountFilter(account.id)}
                      styles={styles}
                    />
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      )}

      <ScrollView style={styles.transactionsList} showsVerticalScrollIndicator={false}>
        {filteredTransactions.length > 0 ? (
          <View style={styles.transactionsGrid}>{filteredTransactions.map(transaction => (
            <TouchableOpacity
              key={transaction.id}
              style={styles.transactionItem}
              onPress={() => handleEdit(transaction)}
              onLongPress={() => openActions(transaction)}
              activeOpacity={0.7}
            >
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor:
                        transaction.type === 'income' ? theme.successLight : theme.errorLight,
                    },
                  ]}
                >
                  <Ionicons
                    name={CATEGORY_ICONS[transaction.category] || 'ellipse'}
                    size={r.font(20)}
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
                    {!!transaction.billId && (
                      <Ionicons name="calendar" size={r.font(11)} color={theme.textSecondary} />
                    )}
                  </View>
                  {accounts.length > 1 && (
                    <Text style={styles.transactionAccount}>
                      {accountNames[transaction.accountId] || '—'}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.amountContainer}>
                <Text
                  style={[
                    styles.transactionAmount,
                    { color: transaction.type === 'income' ? theme.success : theme.error },
                  ]}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </Text>
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => openActions(transaction)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={r.font(16)} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}</View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={r.font(64)} color={theme.border} />
            <Text style={styles.emptyText}>Nenhuma transação encontrada</Text>
            <Text style={styles.emptySubtext}>
              Ajuste os filtros ou adicione um novo lançamento
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const FilterChip = ({ label, icon, active, onPress, styles, theme }) => {
  const r = useResponsive();

  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {!!icon && (
        <Ionicons name={icon} size={r.font(14)} color={active ? '#fff' : theme?.textSecondary} />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
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
  incomeButton: {
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
  expenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: r.space(14),
    borderRadius: 12,
    flex: 1,
    backgroundColor: theme.error,
    elevation: 3,
    shadowColor: theme.error,
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
  summaryRow: {
    flexDirection: 'row',
    gap: r.space(12),
    marginBottom: r.space(8),
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.card,
    padding: r.space(14),
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryLabel: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: r.font(16),
    fontWeight: 'bold',
    marginTop: r.space(4),
  },
  searchBar: {
    marginHorizontal: 0,
    marginVertical: r.space(8),
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: r.space(8),
    marginBottom: r.space(10),
    elevation: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  navButton: {
    padding: r.space(6),
    borderRadius: 8,
    backgroundColor: theme.primaryLight,
  },
  navButtonDisabled: {
    backgroundColor: 'transparent',
  },
  periodLabel: {
    flex: 1,
    alignItems: 'center',
  },
  periodText: {
    color: theme.text,
    fontSize: r.font(15),
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  periodHint: {
    color: theme.textSecondary,
    fontSize: r.font(10),
    marginTop: r.space(1),
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: r.space(10),
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: r.space(4),
    elevation: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButton: {
    flex: 1,
    paddingVertical: r.space(10),
    borderRadius: 10,
    alignItems: 'center',
  },
  activeFilter: {
    backgroundColor: theme.primary,
    elevation: 2,
  },
  filterText: {
    color: theme.textSecondary,
    fontSize: r.font(13),
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#fff',
  },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(6),
    paddingVertical: r.space(8),
    paddingHorizontal: r.space(4),
  },
  filtersToggleText: {
    color: theme.primary,
    fontSize: r.font(13),
    fontWeight: '600',
    flex: 1,
  },
  clearFiltersText: {
    color: theme.textSecondary,
    fontSize: r.font(12),
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginLeft: r.space(8),
  },
  advancedFilters: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: r.space(12),
    marginBottom: r.space(10),
  },
  filterGroupLabel: {
    fontSize: r.font(11),
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: r.space(8),
  },
  chipRow: {
    flexDirection: 'row',
    gap: r.space(8),
    paddingRight: r.space(4),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(5),
    paddingHorizontal: r.space(12),
    paddingVertical: r.space(8),
    borderRadius: 20,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    color: theme.textSecondary,
    fontSize: r.font(12),
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  transactionsList: {
    flex: 1,
  },
  transactionItem: {
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
    marginRight: r.space(14),
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: r.font(15),
    color: theme.text,
    fontWeight: '600',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: r.space(6),
    gap: r.space(8),
  },
  categoryBadge: {
    backgroundColor: theme.primaryLight,
    paddingHorizontal: r.space(8),
    paddingVertical: r.space(2),
    borderRadius: 6,
  },
  transactionCategory: {
    fontSize: r.font(11),
    color: theme.primary,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: r.font(12),
    color: theme.textSecondary,
  },
  transactionAccount: {
    fontSize: r.font(11),
    color: theme.textSecondary,
    marginTop: r.space(4),
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: r.space(6),
  },
  transactionAmount: {
    fontSize: r.font(16),
    fontWeight: 'bold',
  },
  moreButton: {
    padding: r.space(4),
  },
  emptyContainer: {
    flex: 1,
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
  transactionsGrid: {
    ...gridContainer(r.listColumns),
  },
});

export default TransactionsScreen;

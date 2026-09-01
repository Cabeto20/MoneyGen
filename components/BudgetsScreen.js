import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getBudgetStatus, setBudget, deleteBudget } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive, gridContainer, gridItemWidth } from '../utils/responsive';
import { ALL_EXPENSE_CATEGORIES, getCategoryColor, getCategoryIconName } from '../utils/categories';
import { addMonths, getMonthLabel } from '../utils/dateHelpers';
import { useAmountInput } from '../utils/useAmountInput';
import { parseValidAmount } from '../utils/validateAmount';

const STATUS_COPY = {
  ok: { label: 'No limite', icon: 'checkmark-circle' },
  warning: { label: 'Atenção', icon: 'alert-circle' },
  exceeded: { label: 'Estourou', icon: 'close-circle' },
};

const BudgetsScreen = () => {
  const { theme } = useTheme();
  const r = useResponsive();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [budgets, setBudgets] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);

  const styles = createStyles(theme, r);

  const loadBudgets = useCallback(async () => {
    setBudgets(await getBudgetStatus(selectedMonth, selectedYear));
  }, [selectedMonth, selectedYear]);

  useFocusEffect(
    useCallback(() => {
      loadBudgets();
    }, [loadBudgets])
  );

  const totals = useMemo(() => {
    const limit = budgets.reduce((sum, b) => sum + b.limit, 0);
    const spent = budgets.reduce((sum, b) => sum + b.spent, 0);
    return {
      limit,
      spent,
      remaining: limit - spent,
      percent: limit > 0 ? spent / limit : 0,
      exceeded: budgets.filter(b => b.status === 'exceeded').length,
    };
  }, [budgets]);

  const availableCategories = useMemo(
    () => ALL_EXPENSE_CATEGORIES.filter(cat => !budgets.some(b => b.category === cat.name)),
    [budgets]
  );

  const changeMonth = (delta) => {
    const { month, year } = addMonths(selectedMonth, selectedYear, delta);
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const getStatusColor = (status) => {
    if (status === 'exceeded') return theme.error;
    if (status === 'warning') return theme.warning;
    return theme.success;
  };

  const handleSaveBudget = async (category, limit) => {
    await setBudget(category, limit);
    setEditingCategory(null);
    await loadBudgets();
  };

  const handleDeleteBudget = (category) => {
    Alert.alert('Remover Orçamento', `Deseja remover o limite de "${category}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deleteBudget(category);
          setEditingCategory(null);
          await loadBudgets();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.monthNavigator}>
          <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={r.font(22)} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{getMonthLabel(selectedMonth, selectedYear)}</Text>
          <TouchableOpacity style={styles.navButton} onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={r.font(22)} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {budgets.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>Total gasto</Text>
              <Text style={styles.summaryLimit}>de {formatCurrency(totals.limit)}</Text>
            </View>
            <Text
              style={[
                styles.summaryValue,
                { color: totals.remaining < 0 ? theme.error : theme.text },
              ]}
            >
              {formatCurrency(totals.spent)}
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(totals.percent * 100, 100)}%`,
                    backgroundColor: totals.remaining < 0 ? theme.error : theme.primary,
                  },
                ]}
              />
            </View>

            <Text style={styles.summaryFooter}>
              {totals.remaining >= 0
                ? `${formatCurrency(totals.remaining)} disponíveis`
                : `${formatCurrency(Math.abs(totals.remaining))} acima do planejado`}
              {totals.exceeded > 0 &&
                ` · ${totals.exceeded} categoria${totals.exceeded > 1 ? 's' : ''} estourada${
                  totals.exceeded > 1 ? 's' : ''
                }`}
            </Text>
          </View>
        )}

        <View style={styles.budgetsGrid}>{budgets.map(budget => {
          const color = getCategoryColor(budget.category);
          const statusColor = getStatusColor(budget.status);
          const statusCopy = STATUS_COPY[budget.status];

          return (
            <TouchableOpacity
              key={budget.category}
              style={styles.budgetItem}
              onPress={() => setEditingCategory(budget)}
              onLongPress={() => handleDeleteBudget(budget.category)}
              activeOpacity={0.7}
            >
              <View style={styles.budgetHeader}>
                <View style={[styles.categoryIcon, { backgroundColor: color + '20' }]}>
                  <Ionicons
                    name={getCategoryIconName(budget.category)}
                    size={r.font(20)}
                    color={color}
                  />
                </View>
                <View style={styles.budgetTitleGroup}>
                  <Text style={styles.budgetCategory}>{budget.category}</Text>
                  <View style={styles.statusRow}>
                    <Ionicons name={statusCopy.icon} size={r.font(13)} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {statusCopy.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.budgetAmounts}>
                  <Text style={[styles.budgetSpent, { color: statusColor }]}>
                    {formatCurrency(budget.spent)}
                  </Text>
                  <Text style={styles.budgetLimit}>de {formatCurrency(budget.limit)}</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(budget.percent * 100, 100)}%`,
                      backgroundColor: statusColor,
                    },
                  ]}
                />
              </View>

              <Text style={styles.budgetFooter}>
                {(budget.percent * 100).toFixed(0)}% usado
                {budget.remaining >= 0
                  ? ` · restam ${formatCurrency(budget.remaining)}`
                  : ` · ${formatCurrency(Math.abs(budget.remaining))} acima`}
              </Text>
            </TouchableOpacity>
          );
        })}</View>

        {budgets.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={r.font(56)} color={theme.border} />
            <Text style={styles.emptyText}>Nenhum orçamento definido</Text>
            <Text style={styles.emptySubtext}>
              Defina um limite mensal por categoria para acompanhar seus gastos
            </Text>
          </View>
        )}

        {availableCategories.length > 0 && (
          <View style={styles.addSection}>
            <Text style={styles.addTitle}>Adicionar orçamento</Text>
            <View style={styles.chipGrid}>
              {availableCategories.map(cat => (
                <TouchableOpacity
                  key={cat.name}
                  style={styles.chip}
                  onPress={() => setEditingCategory({ category: cat.name, limit: 0 })}
                  activeOpacity={0.8}
                >
                  <Ionicons name={cat.icon} size={r.font(16)} color={cat.color} />
                  <Text style={styles.chipText}>{cat.name}</Text>
                  <Ionicons name="add" size={r.font(16)} color={theme.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <BudgetModal
        budget={editingCategory}
        theme={theme}
        onClose={() => setEditingCategory(null)}
        onSave={handleSaveBudget}
        onDelete={handleDeleteBudget}
      />
    </View>
  );
};

/** Modal de limite. A `key` remonta o estado ao trocar de categoria. */
const BudgetModal = ({ budget, theme, onClose, onSave, onDelete }) => {
  if (!budget) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <BudgetModalContent
        key={budget.category}
        budget={budget}
        theme={theme}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Modal>
  );
};

const BudgetModalContent = ({ budget, theme, onClose, onSave, onDelete }) => {
  const r = useResponsive();
  const styles = createStyles(theme, r);
  const { amount, displayAmount, handleAmountChange } = useAmountInput(budget.limit || null);
  const isNew = !budget.limit;

  const handleConfirm = () => {
    const numAmount = parseValidAmount(amount);
    if (numAmount === null) {
      Alert.alert('Erro', 'Informe um limite maior que zero');
      return;
    }
    onSave(budget.category, numAmount);
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: getCategoryColor(budget.category) + '20' },
            ]}
          >
            <Ionicons
              name={getCategoryIconName(budget.category)}
              size={r.font(20)}
              color={getCategoryColor(budget.category)}
            />
          </View>
          <Text style={styles.modalTitle}>{budget.category}</Text>
        </View>

        <Text style={styles.modalLabel}>Limite mensal</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="R$ 0,00"
          placeholderTextColor={theme.textSecondary}
          value={displayAmount}
          onChangeText={handleAmountChange}
          keyboardType="numeric"
          autoFocus
        />

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalConfirm} onPress={handleConfirm}>
            <Text style={styles.modalConfirmText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        {!isNew && (
          <TouchableOpacity
            style={styles.modalDelete}
            onPress={() => onDelete(budget.category)}
          >
            <Ionicons name="trash-outline" size={r.font(16)} color={theme.error} />
            <Text style={styles.modalDeleteText}>Remover orçamento</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: r.space(16),
    paddingBottom: r.space(32),
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: r.space(12),
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
  monthText: {
    color: theme.text,
    fontSize: r.font(16),
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  summaryCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: r.space(18),
    marginBottom: r.space(16),
    elevation: 3,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: r.font(13),
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryLimit: {
    fontSize: r.font(13),
    color: theme.textSecondary,
  },
  summaryValue: {
    fontSize: r.font(28),
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: r.space(8),
  },
  summaryFooter: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    marginTop: r.space(10),
  },
  budgetItem: {
    width: gridItemWidth(r.listColumns),
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: r.space(16),
    marginBottom: r.space(10),
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: r.space(12),
    gap: r.space(12),
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetTitleGroup: {
    flex: 1,
  },
  budgetCategory: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: theme.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(4),
    marginTop: r.space(3),
  },
  statusText: {
    fontSize: r.font(11),
    fontWeight: '700',
  },
  budgetAmounts: {
    alignItems: 'flex-end',
  },
  budgetSpent: {
    fontSize: r.font(15),
    fontWeight: '700',
  },
  budgetLimit: {
    fontSize: r.font(11),
    color: theme.textSecondary,
    marginTop: r.space(2),
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: r.space(4),
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    fontSize: r.font(11),
    color: theme.textSecondary,
    marginTop: r.space(8),
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: r.space(40),
    paddingHorizontal: r.space(24),
    backgroundColor: theme.card,
    borderRadius: 16,
  },
  emptyText: {
    color: theme.text,
    fontSize: r.font(17),
    fontWeight: '600',
    marginTop: r.space(14),
  },
  emptySubtext: {
    color: theme.textSecondary,
    fontSize: r.font(14),
    marginTop: r.space(6),
    textAlign: 'center',
    lineHeight: r.font(20),
  },
  addSection: {
    marginTop: r.space(24),
  },
  addTitle: {
    fontSize: r.font(14),
    fontWeight: '700',
    color: theme.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: r.space(12),
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: r.space(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(6),
    backgroundColor: theme.card,
    paddingHorizontal: r.space(12),
    paddingVertical: r.space(10),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipText: {
    color: theme.text,
    fontSize: r.font(13),
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    padding: r.space(24),
  },
  modalCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: r.space(22),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(12),
    marginBottom: r.space(20),
  },
  modalTitle: {
    fontSize: r.font(18),
    fontWeight: 'bold',
    color: theme.text,
  },
  modalLabel: {
    fontSize: r.font(12),
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: r.space(8),
  },
  modalInput: {
    backgroundColor: theme.inputBg,
    color: theme.text,
    padding: r.space(16),
    borderRadius: 12,
    fontSize: r.font(18),
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: r.space(10),
    marginTop: r.space(20),
  },
  modalCancel: {
    flex: 1,
    paddingVertical: r.space(14),
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalCancelText: {
    color: theme.textSecondary,
    fontWeight: '600',
    fontSize: r.font(15),
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: r.space(14),
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.primary,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: r.font(15),
  },
  modalDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.space(6),
    marginTop: r.space(14),
    paddingVertical: r.space(8),
  },
  modalDeleteText: {
    color: theme.error,
    fontSize: r.font(13),
    fontWeight: '600',
  },
  budgetsGrid: {
    ...gridContainer(r.listColumns),
  },
});

export default BudgetsScreen;

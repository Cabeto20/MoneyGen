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
import { getGoals, deleteGoal, addGoalDeposit } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive, gridContainer, gridItemWidth } from '../utils/responsive';
import { daysUntil, formatDateBR } from '../utils/dateHelpers';
import { useAmountInput } from '../utils/useAmountInput';
import { parseValidAmount } from '../utils/validateAmount';

const GoalsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const [goals, setGoals] = useState([]);
  const [depositTarget, setDepositTarget] = useState(null);

  const styles = createStyles(theme, r);

  const loadGoals = useCallback(async () => {
    setGoals(await getGoals());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [loadGoals])
  );

  const totals = useMemo(() => {
    const target = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const saved = goals.reduce((sum, goal) => sum + (goal.savedAmount || 0), 0);
    return {
      target,
      saved,
      percent: target > 0 ? saved / target : 0,
      completed: goals.filter(goal => (goal.savedAmount || 0) >= goal.targetAmount).length,
    };
  }, [goals]);

  const handleDelete = (goal) => {
    Alert.alert('Excluir Meta', `Deseja excluir "${goal.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(goal.id);
          await loadGoals();
        },
      },
    ]);
  };

  const handleDeposit = async (goalId, amount) => {
    await addGoalDeposit(goalId, amount);
    setDepositTarget(null);
    await loadGoals();
  };

  /** Quanto guardar por mês para bater a meta até o prazo. */
  const getMonthlyNeeded = (goal) => {
    if (!goal.deadline) return null;

    const remaining = goal.targetAmount - (goal.savedAmount || 0);
    if (remaining <= 0) return null;

    const days = daysUntil(goal.deadline);
    if (days <= 0) return { overdue: true, remaining };

    const months = Math.max(days / 30, 1);
    return { overdue: false, remaining, perMonth: remaining / months, days };
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddGoal')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={r.font(20)} color="#fff" />
          <Text style={styles.addButtonText}>Nova Meta</Text>
        </TouchableOpacity>

        {goals.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total guardado</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.saved)}</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(totals.percent * 100, 100)}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.summaryFooter}>
              {(totals.percent * 100).toFixed(0)}% de {formatCurrency(totals.target)}
              {totals.completed > 0 &&
                ` · ${totals.completed} meta${totals.completed > 1 ? 's' : ''} concluída${
                  totals.completed > 1 ? 's' : ''
                }`}
            </Text>
          </View>
        )}

        <View style={styles.goalsGrid}>{goals.map(goal => {
          const saved = goal.savedAmount || 0;
          const percent = goal.targetAmount > 0 ? saved / goal.targetAmount : 0;
          const isComplete = saved >= goal.targetAmount;
          const pace = getMonthlyNeeded(goal);

          return (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                  <Ionicons
                    name={isComplete ? 'trophy' : goal.icon}
                    size={r.font(22)}
                    color={goal.color}
                  />
                </View>
                <View style={styles.goalTitleGroup}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  {!!goal.deadline && (
                    <Text style={styles.goalDeadline}>
                      Prazo: {formatDateBR(goal.deadline)}
                    </Text>
                  )}
                </View>
                <View style={styles.goalActions}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AddGoal', { goal })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={r.font(19)} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(goal)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={r.font(18)} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.amountRow}>
                <Text style={[styles.goalSaved, { color: goal.color }]}>
                  {formatCurrency(saved)}
                </Text>
                <Text style={styles.goalTarget}>de {formatCurrency(goal.targetAmount)}</Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(percent * 100, 100)}%`,
                      backgroundColor: goal.color,
                    },
                  ]}
                />
              </View>

              <View style={styles.goalFooter}>
                <Text style={styles.goalPercent}>{(percent * 100).toFixed(0)}%</Text>
                {isComplete ? (
                  <Text style={[styles.goalHint, { color: theme.success }]}>
                    Meta alcançada!
                  </Text>
                ) : pace?.overdue ? (
                  <Text style={[styles.goalHint, { color: theme.error }]}>
                    Prazo vencido · faltam {formatCurrency(pace.remaining)}
                  </Text>
                ) : pace ? (
                  <Text style={styles.goalHint}>
                    {formatCurrency(pace.perMonth)}/mês para bater o prazo
                  </Text>
                ) : (
                  <Text style={styles.goalHint}>
                    Faltam {formatCurrency(goal.targetAmount - saved)}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.depositButton, { backgroundColor: goal.color }]}
                onPress={() => setDepositTarget(goal)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={r.font(18)} color="#fff" />
                <Text style={styles.depositButtonText}>Guardar dinheiro</Text>
              </TouchableOpacity>
            </View>
          );
        })}</View>

        {goals.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={r.font(56)} color={theme.border} />
            <Text style={styles.emptyText}>Nenhuma meta criada</Text>
            <Text style={styles.emptySubtext}>
              Defina um objetivo de economia e acompanhe o quanto já guardou
            </Text>
          </View>
        )}
      </ScrollView>

      {!!depositTarget && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDepositTarget(null)}>
          <DepositModal
            key={depositTarget.id}
            goal={depositTarget}
            theme={theme}
            onClose={() => setDepositTarget(null)}
            onConfirm={handleDeposit}
          />
        </Modal>
      )}
    </View>
  );
};

const DepositModal = ({ goal, theme, onClose, onConfirm }) => {
  const r = useResponsive();
  const styles = createStyles(theme, r);
  const [mode, setMode] = useState('deposit');
  const { amount, displayAmount, handleAmountChange } = useAmountInput();

  const saved = goal.savedAmount || 0;

  const handleSubmit = () => {
    const numAmount = parseValidAmount(amount);
    if (numAmount === null) {
      Alert.alert('Erro', 'Informe um valor maior que zero');
      return;
    }

    if (mode === 'withdraw' && numAmount > saved) {
      Alert.alert('Erro', `Você só tem ${formatCurrency(saved)} guardados nesta meta`);
      return;
    }

    onConfirm(goal.id, mode === 'deposit' ? numAmount : -numAmount);
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
            <Ionicons name={goal.icon} size={r.font(20)} color={goal.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{goal.name}</Text>
            <Text style={styles.modalSubtitle}>{formatCurrency(saved)} guardados</Text>
          </View>
        </View>

        <View style={styles.modeRow}>
          {[
            { key: 'deposit', label: 'Guardar', icon: 'arrow-down' },
            { key: 'withdraw', label: 'Resgatar', icon: 'arrow-up' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.modeButton, mode === item.key && styles.modeButtonActive]}
              onPress={() => setMode(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={r.font(16)}
                color={mode === item.key ? '#fff' : theme.textSecondary}
              />
              <Text style={[styles.modeText, mode === item.key && styles.modeTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
          <TouchableOpacity
            style={[styles.modalConfirm, { backgroundColor: goal.color }]}
            onPress={handleSubmit}
          >
            <Text style={styles.modalConfirmText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.space(8),
    backgroundColor: theme.primary,
    paddingVertical: r.space(14),
    borderRadius: 12,
    marginBottom: r.space(16),
    elevation: 3,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: r.font(15),
    fontWeight: 'bold',
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
  summaryLabel: {
    fontSize: r.font(13),
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: r.font(28),
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
    marginVertical: r.space(8),
  },
  summaryFooter: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    marginTop: r.space(10),
  },
  goalCard: {
    width: gridItemWidth(r.listColumns),
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: r.space(16),
    marginBottom: r.space(12),
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(12),
    marginBottom: r.space(14),
  },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitleGroup: {
    flex: 1,
  },
  goalName: {
    fontSize: r.font(16),
    fontWeight: '700',
    color: theme.text,
  },
  goalDeadline: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    marginTop: r.space(3),
  },
  goalActions: {
    flexDirection: 'row',
    gap: r.space(14),
    alignItems: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: r.space(6),
    marginBottom: r.space(8),
  },
  goalSaved: {
    fontSize: r.font(20),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  goalTarget: {
    fontSize: r.font(13),
    color: theme.textSecondary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: r.space(8),
    gap: r.space(8),
  },
  goalPercent: {
    fontSize: r.font(12),
    fontWeight: '700',
    color: theme.text,
  },
  goalHint: {
    fontSize: r.font(11),
    color: theme.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  depositButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.space(6),
    paddingVertical: r.space(11),
    borderRadius: 10,
    marginTop: r.space(14),
  },
  depositButtonText: {
    color: '#fff',
    fontSize: r.font(13),
    fontWeight: 'bold',
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
    marginBottom: r.space(18),
  },
  modalTitle: {
    fontSize: r.font(17),
    fontWeight: 'bold',
    color: theme.text,
  },
  modalSubtitle: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    marginTop: r.space(2),
  },
  modeRow: {
    flexDirection: 'row',
    gap: r.space(8),
    marginBottom: r.space(16),
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.space(6),
    paddingVertical: r.space(11),
    borderRadius: 10,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modeButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  modeText: {
    color: theme.textSecondary,
    fontSize: r.font(13),
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#fff',
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
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: r.font(15),
  },
  goalsGrid: {
    ...gridContainer(r.listColumns),
  },
});

export default GoalsScreen;

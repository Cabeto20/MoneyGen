import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getAccountBalances, deleteAccount } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive, gridContainer, gridItemWidth } from '../utils/responsive';

const AccountsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const [accounts, setAccounts] = useState([]);

  const styles = createStyles(theme, r);

  const loadAccounts = useCallback(async () => {
    setAccounts(await getAccountBalances());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const total = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  const handleDelete = (account) => {
    if (accounts.length <= 1) {
      Alert.alert('Não é possível excluir', 'É preciso manter ao menos uma carteira.');
      return;
    }

    const movedWarning = account.transactionCount > 0
      ? `\n\n${account.transactionCount} lançamento${
          account.transactionCount > 1 ? 's serão movidos' : ' será movido'
        } para outra carteira.`
      : '';

    Alert.alert('Excluir Carteira', `Deseja excluir "${account.name}"?${movedWarning}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const fallback = await deleteAccount(account.id);
            await loadAccounts();
            if (account.transactionCount > 0) {
              Alert.alert('Carteira excluída', `Os lançamentos foram para "${fallback.name}".`);
            }
          } catch (error) {
            Alert.alert('Erro', error.message || 'Falha ao excluir carteira');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddAccount')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={r.font(20)} color="#fff" />
          <Text style={styles.addButtonText}>Nova Carteira</Text>
        </TouchableOpacity>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Patrimônio total</Text>
          <Text
            style={[styles.totalValue, { color: total >= 0 ? theme.text : theme.error }]}
          >
            {formatCurrency(total)}
          </Text>
          <Text style={styles.totalFooter}>
            {accounts.length} carteira{accounts.length > 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.accountsGrid}>{accounts.map(account => (
          <TouchableOpacity
            key={account.id}
            style={styles.accountCard}
            onPress={() => navigation.navigate('AddAccount', { account })}
            onLongPress={() => handleDelete(account)}
            activeOpacity={0.7}
          >
            <View style={[styles.accountIcon, { backgroundColor: account.meta.color + '20' }]}>
              <Ionicons name={account.meta.icon} size={r.font(22)} color={account.meta.color} />
            </View>

            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{account.name}</Text>
              <Text style={styles.accountType}>{account.meta.label}</Text>
              <View style={styles.accountFlow}>
                <Text style={[styles.flowValue, { color: theme.success }]}>
                  +{formatCurrency(account.income)}
                </Text>
                <Text style={[styles.flowValue, { color: theme.error }]}>
                  -{formatCurrency(account.expense)}
                </Text>
              </View>
            </View>

            <View style={styles.accountRight}>
              <Text
                style={[
                  styles.accountBalance,
                  { color: account.balance >= 0 ? theme.text : theme.error },
                ]}
              >
                {formatCurrency(account.balance)}
              </Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(account)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={r.font(16)} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}</View>

        <Text style={styles.hint}>
          Toque em uma carteira para editar. Ao excluir, os lançamentos são movidos para outra
          carteira — nada é perdido.
        </Text>
      </ScrollView>
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
  totalCard: {
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
  totalLabel: {
    fontSize: r.font(13),
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: r.font(30),
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: r.space(6),
  },
  totalFooter: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    marginTop: r.space(4),
  },
  accountCard: {
    width: gridItemWidth(r.listColumns),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: r.space(16),
    marginBottom: r.space(10),
    gap: r.space(14),
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  accountIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: r.font(15),
    fontWeight: '700',
    color: theme.text,
  },
  accountType: {
    fontSize: r.font(12),
    color: theme.textSecondary,
    marginTop: r.space(2),
  },
  accountFlow: {
    flexDirection: 'row',
    gap: r.space(10),
    marginTop: r.space(6),
  },
  flowValue: {
    fontSize: r.font(11),
    fontWeight: '600',
  },
  accountRight: {
    alignItems: 'flex-end',
    gap: r.space(8),
  },
  accountBalance: {
    fontSize: r.font(16),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  deleteButton: {
    padding: r.space(2),
  },
  hint: {
    color: theme.textSecondary,
    fontSize: r.font(12),
    lineHeight: r.font(18),
    marginTop: r.space(12),
    paddingHorizontal: r.space(4),
  },
  accountsGrid: {
    ...gridContainer(r.listColumns),
  },
});

export default AccountsScreen;

import React, { useState, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import {
  addTransaction,
  updateTransaction,
  getAccounts,
  DEFAULT_ACCOUNT_ID,
} from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../utils/categories';
import { useAmountInput } from '../utils/useAmountInput';
import { parseValidAmount } from '../utils/validateAmount';
import { getTransactionDate } from '../utils/dateHelpers';
import CategoryPicker from './CategoryPicker';
import AccountPicker from './AccountPicker';

const COPY = {
  income: {
    categories: INCOME_CATEGORIES,
    icon: 'arrow-down',
    addTitle: 'Nova Receita',
    editTitle: 'Editar Receita',
    saveLabel: 'Salvar Receita',
    placeholder: 'Ex: Salário mensal',
    errorLabel: 'receita',
  },
  expense: {
    categories: EXPENSE_CATEGORIES,
    icon: 'arrow-up',
    addTitle: 'Nova Despesa',
    editTitle: 'Editar Despesa',
    saveLabel: 'Salvar Despesa',
    placeholder: 'Ex: Supermercado',
    errorLabel: 'despesa',
  },
};

/**
 * Formulário compartilhado por receitas e despesas. Recebe
 * `route.params.transaction` para entrar em modo de edição.
 */
const TransactionForm = ({ navigation, route, type }) => {
  const { theme } = useTheme();
  const copy = COPY[type];
  const accent = type === 'income' ? theme.success : theme.error;
  const accentLight = type === 'income' ? theme.successLight : theme.errorLight;

  const editing = route?.params?.transaction || null;

  const [description, setDescription] = useState(editing?.description || '');
  const [category, setCategory] = useState(editing?.category || '');
  const [accountId, setAccountId] = useState(editing?.accountId || DEFAULT_ACCOUNT_ID);
  const [date, setDate] = useState(() =>
    editing ? getTransactionDate(editing) || new Date() : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const { amount, displayAmount, handleAmountChange } = useAmountInput(editing?.amount ?? null);

  const styles = createStyles(theme, accent);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editing ? copy.editTitle : copy.addTitle });
  }, [navigation, editing, copy]);

  useEffect(() => {
    getAccounts().then(loaded => {
      setAccounts(loaded);
      // Carteira do lançamento pode ter sido removida — cai na primeira.
      if (!loaded.some(account => account.id === accountId)) {
        setAccountId(loaded[0]?.id || DEFAULT_ACCOUNT_ID);
      }
    });
  }, []);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleSave = async () => {
    if (!description.trim() || !amount || !category) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const numAmount = parseValidAmount(amount);
    if (numAmount === null) {
      Alert.alert('Erro', 'Valor deve ser maior que zero');
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        await updateTransaction(editing.id, {
          description: description.trim(),
          amount: numAmount,
          category,
          accountId,
          date,
        });
      } else {
        await addTransaction(description.trim(), numAmount, type, category, {
          accountId,
          date,
        });
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', `Falha ao salvar ${copy.errorLabel}`);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <View style={styles.headerBadge}>
          <View style={[styles.headerIcon, { backgroundColor: accentLight }]}>
            <Ionicons name={copy.icon} size={24} color={accent} />
          </View>
          <Text style={styles.headerText}>{editing ? copy.editTitle : copy.addTitle}</Text>
        </View>

        {!!editing?.billId && (
          <View style={styles.notice}>
            <Ionicons name="information-circle" size={18} color={theme.warning} />
            <Text style={styles.noticeText}>
              Lançamento gerado ao quitar uma conta. Excluí-lo reabre a conta no mês.
            </Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={styles.input}
            placeholder={copy.placeholder}
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor</Text>
          <TextInput
            style={styles.input}
            placeholder="R$ 0,00"
            placeholderTextColor={theme.textSecondary}
            value={displayAmount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Data</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color={accent} />
            <Text style={styles.dateButtonText}>{date.toLocaleDateString('pt-BR')}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
        )}

        {accounts.length > 1 && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Carteira</Text>
            <AccountPicker
              accounts={accounts}
              selected={accountId}
              onSelect={setAccountId}
              theme={theme}
              accentColor={accent}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoria</Text>
          <CategoryPicker
            categories={copy.categories}
            selected={category}
            onSelect={setCategory}
            theme={theme}
            accentColor={accent}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.saveButtonText}>
            {editing ? 'Salvar Alterações' : copy.saveLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme, accent) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  form: {
    padding: 20,
  },
  headerBadge: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.warningLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    color: theme.text,
    fontSize: 12,
    lineHeight: 17,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  dateButton: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: {
    color: theme.text,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: accent,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default TransactionForm;

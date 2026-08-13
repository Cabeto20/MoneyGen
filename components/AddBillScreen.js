import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import {
  addBill,
  updateBill,
  getAccounts,
  scheduleAllBillNotifications,
  DEFAULT_ACCOUNT_ID,
} from '../database/database';
import { cancelNotificationForBill } from '../utils/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { BILL_CATEGORIES as CATEGORIES } from '../utils/categories';
import { useAmountInput } from '../utils/useAmountInput';
import { parseValidAmount } from '../utils/validateAmount';
import CategoryPicker from './CategoryPicker';
import AccountPicker from './AccountPicker';

const cancelBillNotifications = async (bill) => {
  for (const id of [bill.notificationId, bill.reminderNotificationId, bill.midnightNotificationId]) {
    if (id) await cancelNotificationForBill(id);
  }
};

const AddBillScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const editing = route?.params?.bill || null;

  const [description, setDescription] = useState(editing?.description || '');
  const [dueDate, setDueDate] = useState(() => {
    if (!editing) return new Date();
    if (editing.dueDate) return new Date(editing.dueDate);

    // Contas fixas só guardam o dia — reconstrói no mês corrente.
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), editing.dueDay);
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState(editing?.category || '');
  const [billType, setBillType] = useState(editing?.billType || 'fixa');
  const [installments, setInstallments] = useState('');
  const [accountId, setAccountId] = useState(editing?.accountId || DEFAULT_ACCOUNT_ID);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const { amount, displayAmount, handleAmountChange } = useAmountInput(editing?.amount ?? null);

  const styles = createStyles(theme);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editing ? 'Editar Conta' : 'Nova Conta' });
  }, [navigation, editing]);

  useEffect(() => {
    getAccounts().then(loaded => {
      setAccounts(loaded);
      if (!loaded.some(account => account.id === accountId)) {
        setAccountId(loaded[0]?.id || DEFAULT_ACCOUNT_ID);
      }
    });
  }, []);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDueDate(selectedDate);
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

    if (!editing && billType === 'parcelada' && (!installments || parseInt(installments, 10) < 2)) {
      Alert.alert('Erro', 'Informe o número de parcelas (mínimo 2)');
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        await saveEdit(numAmount);
      } else {
        await saveNew(numAmount);
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar conta');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async (numAmount) => {
    const totalInstallments = billType === 'parcelada' ? parseInt(installments, 10) : 1;

    const created = await addBill(
      description.trim(),
      numAmount,
      dueDate.getDate(),
      category,
      billType,
      totalInstallments,
      dueDate,
      accountId
    );

    const bills = Array.isArray(created) ? created : [created];
    for (const bill of bills) {
      await updateBill(bill.id, await scheduleAllBillNotifications(bill));
    }
  };

  const saveEdit = async (numAmount) => {
    const dueDayChanged = dueDate.getDate() !== editing.dueDay;
    const fields = {
      description: description.trim(),
      amount: numAmount,
      category,
      accountId,
      dueDate,
    };

    // Valor ou data mudaram: os lembretes agendados ficaram desatualizados.
    if (dueDayChanged || numAmount !== editing.amount) {
      await cancelBillNotifications(editing);
      Object.assign(
        fields,
        await scheduleAllBillNotifications({ ...editing, ...fields, dueDay: dueDate.getDate() })
      );
    }

    await updateBill(editing.id, fields);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Aluguel do apartamento"
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
          <Text style={styles.label}>Vencimento</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            <Text style={styles.dateButtonText}>{dueDate.toLocaleDateString('pt-BR')}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker value={dueDate} mode="date" display="default" onChange={onDateChange} />
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo de Conta</Text>
          <View style={styles.typeRow}>
            {[
              { key: 'fixa', label: 'Fixa', icon: 'repeat' },
              { key: 'parcelada', label: 'Parcelada', icon: 'layers' },
              { key: 'unica', label: 'Única', icon: 'document' },
            ].map(item => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.typeButton,
                  billType === item.key && styles.selectedType,
                  !!editing && styles.disabledType,
                ]}
                onPress={() => !editing && setBillType(item.key)}
                disabled={!!editing}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={billType === item.key ? '#fff' : theme.textSecondary}
                />
                <Text style={[styles.typeText, billType === item.key && styles.selectedTypeText]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!editing && (
            <Text style={styles.hint}>
              O tipo não pode ser alterado. Exclua a conta e crie outra, se precisar.
            </Text>
          )}
        </View>

        {!editing && billType === 'parcelada' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número de Parcelas</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 12"
              placeholderTextColor={theme.textSecondary}
              value={installments}
              onChangeText={setInstallments}
              keyboardType="numeric"
            />
          </View>
        )}

        {accounts.length > 1 && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pagar com</Text>
            <AccountPicker
              accounts={accounts}
              selected={accountId}
              onSelect={setAccountId}
              theme={theme}
              accentColor={theme.primary}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoria</Text>
          <CategoryPicker
            categories={CATEGORIES}
            selected={category}
            onSelect={setCategory}
            theme={theme}
            accentColor={theme.primary}
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
            {editing ? 'Salvar Alterações' : 'Salvar Conta'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  form: {
    padding: 20,
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
  hint: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
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
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    gap: 4,
  },
  selectedType: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  disabledType: {
    opacity: 0.6,
  },
  typeText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  selectedTypeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: theme.primary,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: theme.primary,
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

export default AddBillScreen;

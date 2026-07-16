import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatCurrency';
import { addBill, getBills } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';

const CATEGORIES = [
  { name: 'Aluguel', icon: 'home' },
  { name: 'Energia', icon: 'flash' },
  { name: 'Água', icon: 'water' },
  { name: 'Internet', icon: 'wifi' },
  { name: 'Telefone', icon: 'call' },
  { name: 'Cartão', icon: 'card' },
  { name: 'Financiamento', icon: 'cash' },
  { name: 'Seguro', icon: 'shield-checkmark' },
];

const AddBillScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState('');
  const [billType, setBillType] = useState('fixa');
  const [installments, setInstallments] = useState('');

  const styles = createStyles(theme);

  const handleAmountChange = (text) => {
    const numericValue = text.replace(/\D/g, '');
    const floatValue = parseFloat(numericValue) / 100;
    
    if (numericValue === '') {
      setAmount('');
      setDisplayAmount('');
      return;
    }
    
    setAmount(floatValue.toString());
    setDisplayAmount(formatCurrency(floatValue));
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dueDate;
    setShowDatePicker(Platform.OS === 'ios');
    setDueDate(currentDate);
  };

  const addBillHandler = async () => {
    if (!description || !amount || !category) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Erro', 'Valor deve ser maior que zero');
      return;
    }

    if (billType === 'parcelada' && (!installments || parseInt(installments) < 2)) {
      Alert.alert('Erro', 'Informe o número de parcelas (mínimo 2)');
      return;
    }

    try {
      const dueDay = dueDate.getDate();
      const totalInstallments = billType === 'parcelada' ? parseInt(installments) : 1;
      
      const newBills = await addBill(description, numAmount, dueDay, category, billType, totalInstallments, dueDate);
      
      const { scheduleNotificationForBill, scheduleReminderForBill, scheduleMidnightNotification } = require('../utils/notifications');
      
      const billsToNotify = Array.isArray(newBills) ? newBills : [newBills];
      const bills = await getBills();
      
      for (const bill of billsToNotify) {
        const notificationId = await scheduleNotificationForBill(bill);
        const reminderNotificationId = await scheduleReminderForBill(bill, 1);
        const midnightNotificationId = await scheduleMidnightNotification(bill);
        
        if (notificationId || reminderNotificationId || midnightNotificationId) {
          const updatedBills = bills.map(b => 
            b.id === bill.id ? { 
              ...b, 
              notificationId, 
              reminderNotificationId,
              midnightNotificationId
            } : b
          );
          await AsyncStorage.setItem('bills', JSON.stringify(updatedBills));
        }
      }
      
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar conta');
      console.error(error);
    }
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
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            <Text style={styles.dateButtonText}>
              {dueDate.toLocaleDateString('pt-BR')}
            </Text>
          </TouchableOpacity>
        </View>
        
        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
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
                style={[styles.typeButton, billType === item.key && styles.selectedType]}
                onPress={() => setBillType(item.key)}
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
        </View>
        
        {billType === 'parcelada' && (
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
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoria</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                style={[styles.categoryButton, category === cat.name && styles.selectedCategory]}
                onPress={() => setCategory(cat.name)}
              >
                <Ionicons 
                  name={cat.icon} 
                  size={20} 
                  color={category === cat.name ? '#fff' : theme.textSecondary} 
                />
                <Text style={[styles.categoryText, category === cat.name && styles.selectedCategoryText]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <TouchableOpacity style={styles.saveButton} onPress={addBillHandler} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.saveButtonText}>Salvar Conta</Text>
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
  typeText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  selectedTypeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    backgroundColor: theme.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    flexDirection: 'row',
    gap: 8,
  },
  selectedCategory: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  categoryText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedCategoryText: {
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
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default AddBillScreen;
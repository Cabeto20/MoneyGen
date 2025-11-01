import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatCurrency } from '../utils/formatCurrency';
import { addBill } from '../database/database';

const AddBillScreen = ({ navigation }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [category, setCategory] = useState('');
  const [billType, setBillType] = useState('fixa');
  const [installments, setInstallments] = useState('');

  const categories = ['Aluguel', 'Energia', 'Água', 'Internet', 'Telefone', 'Cartão', 'Financiamento', 'Seguro'];

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

    if (billType === 'parcelada' && (!installments || parseInt(installments) < 2)) {
      Alert.alert('Erro', 'Informe o número de parcelas (mínimo 2)');
      return;
    }

    const dueDay = dueDate.getDate();
    const totalInstallments = billType === 'parcelada' ? parseInt(installments) : 1;
    
    await addBill(description, parseFloat(amount), dueDay, category, billType, totalInstallments, dueDate);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Descrição da conta"
          placeholderTextColor="#666"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="R$ 0,00"
          placeholderTextColor="#666"
          value={displayAmount}
          onChangeText={handleAmountChange}
          keyboardType="numeric"
        />
        <TouchableOpacity 
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateButtonText}>
            Vencimento: {dueDate.toLocaleDateString('pt-BR')}
          </Text>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}
        
        <View style={styles.categoryContainer}>
          <Text style={styles.categoryLabel}>Tipo de Conta:</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeButton, billType === 'fixa' && styles.selectedType]}
              onPress={() => setBillType('fixa')}
            >
              <Text style={[styles.typeText, billType === 'fixa' && styles.selectedTypeText]}>Fixa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, billType === 'parcelada' && styles.selectedType]}
              onPress={() => setBillType('parcelada')}
            >
              <Text style={[styles.typeText, billType === 'parcelada' && styles.selectedTypeText]}>Parcelada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, billType === 'unica' && styles.selectedType]}
              onPress={() => setBillType('unica')}
            >
              <Text style={[styles.typeText, billType === 'unica' && styles.selectedTypeText]}>Única</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {billType === 'parcelada' && (
          <TextInput
            style={styles.input}
            placeholder="Número de parcelas"
            placeholderTextColor="#666"
            value={installments}
            onChangeText={setInstallments}
            keyboardType="numeric"
          />
        )}
        
        <View style={styles.categoryContainer}>
          <Text style={styles.categoryLabel}>Categoria:</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryButton, category === cat && styles.selectedCategory]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && styles.selectedCategoryText]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <TouchableOpacity style={styles.saveButton} onPress={addBillHandler}>
          <Text style={styles.saveButtonText}>Salvar Conta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  form: {
    padding: 20,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    fontWeight: 'bold',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedCategory: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  categoryText: {
    color: '#ccc',
    fontSize: 14,
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#8b5cf6',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateButton: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  typeButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedType: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  typeText: {
    color: '#ccc',
    fontSize: 14,
  },
  selectedTypeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default AddBillScreen;
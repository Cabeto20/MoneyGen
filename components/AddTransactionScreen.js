import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatCurrency';
import { addTransaction } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';

const CATEGORIES = [
  { name: 'Salário', icon: 'wallet' },
  { name: 'Freelance', icon: 'laptop' },
  { name: 'Investimentos', icon: 'trending-up' },
  { name: 'Vendas', icon: 'pricetag' },
  { name: 'Bonificação', icon: 'gift' },
  { name: 'Prêmio', icon: 'trophy' },
  { name: 'Aluguel Recebido', icon: 'business' },
  { name: 'Outros', icon: 'ellipsis-horizontal' },
];

const AddTransactionScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [category, setCategory] = useState('');

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

  const addTransactionHandler = async () => {
    if (!description || !amount || !category) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Erro', 'Valor deve ser maior que zero');
      return;
    }

    try {
      await addTransaction(description, numAmount, 'income', category);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar receita');
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <View style={styles.headerBadge}>
          <View style={[styles.headerIcon, { backgroundColor: theme.successLight }]}>
            <Ionicons name="arrow-down" size={24} color={theme.success} />
          </View>
          <Text style={styles.headerText}>Nova Receita</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Salário mensal"
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
        
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={addTransactionHandler}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.saveButtonText}>Salvar Receita</Text>
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    backgroundColor: theme.card,
    paddingHorizontal: 14,
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
    backgroundColor: theme.success,
    borderColor: theme.success,
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
    backgroundColor: theme.success,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: theme.success,
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

export default AddTransactionScreen;
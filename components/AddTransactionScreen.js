import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { formatCurrency } from '../utils/formatCurrency';
import { addTransaction } from '../database/database';

const AddTransactionScreen = ({ navigation }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [category, setCategory] = useState('');

  const categories = ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Bonificação', 'Prêmio', 'Aluguel Recebido'];

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

  const addTransactionHandler = async (type) => {
    if (!description || !amount || !category) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    await addTransaction(description, parseFloat(amount), type, category);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Descrição"
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
        
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={() => addTransactionHandler('income')}
        >
          <Text style={styles.saveButtonText}>Salvar Receita</Text>
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
    paddingHorizontal: 15,
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
    backgroundColor: '#10b981',
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
});

export default AddTransactionScreen;
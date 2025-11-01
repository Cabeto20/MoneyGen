import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CategoriesScreen = () => {
  const [categories] = useState([
    { id: 1, name: 'Alimentação', icon: 'restaurant', color: '#ff6b6b', type: 'expense' },
    { id: 2, name: 'Transporte', icon: 'car', color: '#4ecdc4', type: 'expense' },
    { id: 3, name: 'Moradia', icon: 'home', color: '#45b7d1', type: 'expense' },
    { id: 4, name: 'Saúde', icon: 'medical', color: '#96ceb4', type: 'expense' },
    { id: 5, name: 'Educação', icon: 'school', color: '#feca57', type: 'expense' },
    { id: 6, name: 'Lazer', icon: 'game-controller', color: '#ff9ff3', type: 'expense' },
    { id: 7, name: 'Salário', icon: 'wallet', color: '#10b981', type: 'income' },
    { id: 8, name: 'Freelance', icon: 'laptop', color: '#10b981', type: 'income' },
    { id: 9, name: 'Investimentos', icon: 'trending-up', color: '#10b981', type: 'income' },
  ]);

  const expenseCategories = categories.filter(cat => cat.type === 'expense');
  const incomeCategories = categories.filter(cat => cat.type === 'income');

  const CategoryCard = ({ category }) => (
    <TouchableOpacity style={[styles.categoryCard, { borderColor: category.color }]}>
      <View style={[styles.iconContainer, { backgroundColor: category.color }]}>
        <Ionicons name={category.icon} size={24} color="#fff" />
      </View>
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Despesas</Text>
        <View style={styles.categoriesGrid}>
          {expenseCategories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Receitas</Text>
        <View style={styles.categoriesGrid}>
          {incomeCategories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    backgroundColor: '#1a1a1a',
    width: '48%',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default CategoriesScreen;
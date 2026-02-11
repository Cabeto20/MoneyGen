import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FloatingActionButton = ({ onAddExpense, onAddIncome, onAddBill }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
    
    setIsOpen(!isOpen);
  };

  const handleAction = (action) => {
    toggleMenu();
    setTimeout(() => action(), 200);
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const translateY1 = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -70],
  });

  const translateY2 = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -130],
  });

  const translateY3 = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -190],
  });

  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Despesa */}
      <Animated.View style={[styles.actionButton, styles.expenseButton, {
        transform: [{ translateY: translateY1 }],
        opacity,
      }]}>
        <TouchableOpacity onPress={() => handleAction(onAddExpense)}>
          <Ionicons name="remove" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.actionLabel}>Despesa</Text>
      </Animated.View>

      {/* Receita */}
      <Animated.View style={[styles.actionButton, styles.incomeButton, {
        transform: [{ translateY: translateY2 }],
        opacity,
      }]}>
        <TouchableOpacity onPress={() => handleAction(onAddIncome)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.actionLabel}>Receita</Text>
      </Animated.View>

      {/* Conta */}
      <Animated.View style={[styles.actionButton, styles.billButton, {
        transform: [{ translateY: translateY3 }],
        opacity,
      }]}>
        <TouchableOpacity onPress={() => handleAction(onAddBill)}>
          <Ionicons name="calendar" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.actionLabel}>Conta</Text>
      </Animated.View>

      {/* Botão Principal */}
      <TouchableOpacity style={styles.mainButton} onPress={toggleMenu}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="add" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    alignItems: 'center',
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionButton: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  expenseButton: {
    backgroundColor: '#ef4444',
  },
  incomeButton: {
    backgroundColor: '#10b981',
  },
  billButton: {
    backgroundColor: '#f59e0b',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default FloatingActionButton;
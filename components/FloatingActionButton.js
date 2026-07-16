import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const FloatingActionButton = ({ onAddExpense, onAddIncome, onAddBill }) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const styles = createStyles(theme);

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

  const scaleInterpolation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <View style={styles.container}>
      {/* Overlay */}
      {isOpen && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1}
          onPress={toggleMenu}
        />
      )}

      {/* Despesa */}
      <Animated.View style={[styles.actionButton, styles.expenseButton, {
        transform: [{ translateY: translateY1 }, { scale: scaleInterpolation }],
        opacity,
      }]}>
        <TouchableOpacity 
          style={styles.actionTouchable}
          onPress={() => handleAction(onAddExpense)}
        >
          <Ionicons name="remove" size={20} color="#fff" />
          <Text style={styles.actionLabel}>Despesa</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Receita */}
      <Animated.View style={[styles.actionButton, styles.incomeButton, {
        transform: [{ translateY: translateY2 }, { scale: scaleInterpolation }],
        opacity,
      }]}>
        <TouchableOpacity 
          style={styles.actionTouchable}
          onPress={() => handleAction(onAddIncome)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.actionLabel}>Receita</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Conta */}
      <Animated.View style={[styles.actionButton, styles.billButton, {
        transform: [{ translateY: translateY3 }, { scale: scaleInterpolation }],
        opacity,
      }]}>
        <TouchableOpacity 
          style={styles.actionTouchable}
          onPress={() => handleAction(onAddBill)}
        >
          <Ionicons name="calendar" size={20} color="#fff" />
          <Text style={styles.actionLabel}>Conta</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Botão Principal */}
      <TouchableOpacity style={styles.mainButton} onPress={toggleMenu} activeOpacity={0.85}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -100,
    backgroundColor: theme.overlay,
  },
  mainButton: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionButton: {
    position: 'absolute',
    borderRadius: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  actionTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expenseButton: {
    backgroundColor: theme.error,
  },
  incomeButton: {
    backgroundColor: theme.success,
  },
  billButton: {
    backgroundColor: theme.warning,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '700',
  },
});

export default FloatingActionButton;
import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const lightTheme = {
  background: '#f0f2f5',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  primary: '#7c3aed',
  primaryLight: '#ede9fe',
  primaryDark: '#5b21b6',
  success: '#059669',
  successLight: '#d1fae5',
  error: '#dc2626',
  errorLight: '#fee2e2',
  warning: '#d97706',
  warningLight: '#fef3c7',
  border: '#e5e7eb',
  tabBar: '#ffffff',
  tabBarBorder: '#e5e7eb',
  inputBg: '#f9fafb',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.4)',
  gradient1: '#7c3aed',
  gradient2: '#a78bfa',
};

const darkTheme = {
  background: '#0f0f14',
  surface: '#1a1a24',
  card: '#1e1e2d',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  primary: '#8b5cf6',
  primaryLight: '#2d2250',
  primaryDark: '#7c3aed',
  success: '#10b981',
  successLight: '#064e3b',
  error: '#ef4444',
  errorLight: '#7f1d1d',
  warning: '#f59e0b',
  warningLight: '#78350f',
  border: '#2d2d3d',
  tabBar: '#14141e',
  tabBarBorder: '#2d2d3d',
  inputBg: '#1a1a24',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.6)',
  gradient1: '#8b5cf6',
  gradient2: '#6d28d9',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Erro ao carregar tema:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f14' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
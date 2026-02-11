import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './database/database';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

import HomeScreen from './components/HomeScreen';
import TransactionsScreen from './components/TransactionsScreen';
import BillsScreen from './components/BillsScreen';
import AddBillScreen from './components/AddBillScreen';
import AddTransactionScreen from './components/AddTransactionScreen';
import AddExpenseScreen from './components/AddExpenseScreen';
import BackupScreen from './components/BackupScreen';
import SettingsScreen from './components/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const BillsStack = () => {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="BillsList" 
        component={BillsScreen} 
        options={{ title: 'Contas' }}
      />
      <Stack.Screen 
        name="AddBill" 
        component={AddBillScreen} 
        options={{ title: 'Nova Conta' }}
      />
      <Stack.Screen 
        name="AddTransaction" 
        component={AddTransactionScreen} 
        options={{ title: 'Nova Receita' }}
      />
    </Stack.Navigator>
  );
};

const TransactionsStack = () => {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="TransactionsList" 
        component={TransactionsScreen} 
        options={{ title: 'Transações' }}
      />
      <Stack.Screen 
        name="AddTransaction" 
        component={AddTransactionScreen} 
        options={{ title: 'Nova Receita' }}
      />
      <Stack.Screen 
        name="AddExpense" 
        component={AddExpenseScreen} 
        options={{ title: 'Nova Despesa' }}
      />
      <Stack.Screen 
        name="Backup" 
        component={BackupScreen} 
        options={{ title: 'Backup & Exportação' }}
      />
    </Stack.Navigator>
  );
};

const AppContent = () => {
  const { theme, isDark } = useTheme();

  useEffect(() => {
    const setupDatabase = async () => {
      await initDatabase();
    };
    setupDatabase();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Transações') {
              iconName = focused ? 'list' : 'list-outline';
            } else if (route.name === 'Contas') {
              iconName = focused ? 'calendar' : 'calendar-outline';
            } else if (route.name === 'Configurações') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.tabBar,
            borderTopColor: theme.tabBarBorder,
            height: 60,
            paddingBottom: 8,
          },
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'Início' }}
        />
        <Tab.Screen 
          name="Transações" 
          component={TransactionsStack} 
          options={{ headerShown: false }}
        />
        <Tab.Screen 
          name="Contas" 
          component={BillsStack} 
          options={{ headerShown: false }}
        />
        <Tab.Screen 
          name="Configurações" 
          component={SettingsScreen} 
          options={{ title: 'Configurações' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
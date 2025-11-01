import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './database/database';

import HomeScreen from './components/HomeScreen';
import TransactionsScreen from './components/TransactionsScreen';
import CategoriesScreen from './components/CategoriesScreen';

const Tab = createBottomTabNavigator();

const App = () => {
  useEffect(() => {
    const setupDatabase = async () => {
      await initDatabase();
    };
    setupDatabase();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Transações') {
              iconName = focused ? 'list' : 'list-outline';
            } else if (route.name === 'Categorias') {
              iconName = focused ? 'grid' : 'grid-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#8b5cf6',
          tabBarInactiveTintColor: '#666',
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopColor: '#333',
            height: 60,
            paddingBottom: 8,
          },
          headerStyle: {
            backgroundColor: '#1a1a1a',
          },
          headerTintColor: '#fff',
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
          component={TransactionsScreen} 
        />
        <Tab.Screen 
          name="Categorias" 
          component={CategoriesScreen} 
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};



export default App;
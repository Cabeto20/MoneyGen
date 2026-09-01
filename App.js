import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { initDatabase } from './database/database';
import { setupNotificationChannel } from './utils/notifications';
import { refreshWeeklySummary } from './utils/weeklySummary';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useResponsive } from './utils/responsive';

import HomeScreen from './components/HomeScreen';
import TransactionsScreen from './components/TransactionsScreen';
import BillsScreen from './components/BillsScreen';
import AddBillScreen from './components/AddBillScreen';
import AddTransactionScreen from './components/AddTransactionScreen';
import AddExpenseScreen from './components/AddExpenseScreen';
import BackupScreen from './components/BackupScreen';
import ImportTxtScreen from './components/ImportTxtScreen';
import SettingsScreen from './components/SettingsScreen';
import StatsScreen from './components/StatsScreen';
import PlanningScreen from './components/PlanningScreen';
import BudgetsScreen from './components/BudgetsScreen';
import GoalsScreen from './components/GoalsScreen';
import AddGoalScreen from './components/AddGoalScreen';
import AccountsScreen from './components/AccountsScreen';
import AddAccountScreen from './components/AddAccountScreen';
import SecurityScreen from './components/SecurityScreen';
import LockGate from './components/LockGate';
import SideMenu from './components/SideMenu';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();
const MenuContext = React.createContext({ openMenu: () => {} });

// Mantém a splash nativa (fundo escuro) visível até o primeiro frame do React
// pintar — sem isso, o Android mostra um flash branco entre a splash e a UI.
SplashScreen.preventAutoHideAsync().catch(() => {});

const getStackScreenOptions = (theme, r) => ({
  headerStyle: { backgroundColor: theme.surface },
  headerShadowVisible: false,
  headerTintColor: theme.text,
  headerTitleStyle: { fontWeight: 'bold', fontSize: r.font(18) },
  // Em tela larga o conteúdo para numa largura legível e fica centralizado, em
  // vez de esticar de ponta a ponta. Fica aqui, no container de conteúdo da
  // stack, para valer para todas as telas de uma vez.
  contentStyle: {
    backgroundColor: theme.background,
    width: '100%',
    maxWidth: r.contentMaxWidth,
    alignSelf: 'center',
  },
  animation: 'slide_from_right',
  freezeOnBlur: true,
});

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

/**
 * As 6 telas do menu lateral usam este header: seta de voltar quando a tela
 * foi empilhada por outra (ex.: Ajustes -> Carteiras), ícone de menu quando
 * é a raiz da pilha (ex.: abertura do app ou chegada direto pelo menu).
 */
const HeaderLeftButton = ({ navigation, theme }) => {
  const { openMenu } = useContext(MenuContext);
  const r = useResponsive();

  if (navigation.canGoBack()) {
    return (
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.headerButton}
        hitSlop={HIT_SLOP}
      >
        <Ionicons name="chevron-back" size={r.font(26)} color={theme.text} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={openMenu} style={styles.headerButton} hitSlop={HIT_SLOP}>
      <Ionicons name="menu" size={r.font(26)} color={theme.text} />
    </TouchableOpacity>
  );
};

const withMenuHeader = (title, theme) => ({ navigation }) => ({
  title,
  headerLeft: () => <HeaderLeftButton navigation={navigation} theme={theme} />,
});

/**
 * Stack única para todo o app: qualquer tela empilhada a partir de qualquer
 * outra guarda o histórico real, então "voltar" sempre retorna para onde o
 * usuário estava antes (e não para o Início).
 */
const MainStack = () => {
  const { theme } = useTheme();
  const r = useResponsive();

  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={getStackScreenOptions(theme, r)}>
      <Stack.Screen name="Home" component={HomeScreen} options={withMenuHeader('Início', theme)} />
      <Stack.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={withMenuHeader('Transações', theme)}
      />
      <Stack.Screen name="Bills" component={BillsScreen} options={withMenuHeader('Contas', theme)} />
      <Stack.Screen name="Stats" component={StatsScreen} options={withMenuHeader('Relatórios', theme)} />
      <Stack.Screen
        name="Planning"
        component={PlanningScreen}
        options={withMenuHeader('Planejamento', theme)}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={withMenuHeader('Configurações', theme)}
      />

      <Stack.Screen name="Budgets" component={BudgetsScreen} options={{ title: 'Orçamentos' }} />
      <Stack.Screen name="Goals" component={GoalsScreen} options={{ title: 'Metas' }} />
      <Stack.Screen name="AddGoal" component={AddGoalScreen} options={{ title: 'Nova Meta' }} />
      <Stack.Screen name="Accounts" component={AccountsScreen} options={{ title: 'Carteiras' }} />
      <Stack.Screen
        name="AddAccount"
        component={AddAccountScreen}
        options={{ title: 'Nova Carteira' }}
      />
      <Stack.Screen name="AddBill" component={AddBillScreen} options={{ title: 'Nova Conta' }} />
      <Stack.Screen
        name="AddTransactionBills"
        component={AddTransactionScreen}
        options={{ title: 'Nova Receita' }}
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
      <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Bloqueio do App' }} />
      <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Backup & Exportação' }} />
      <Stack.Screen
        name="ImportTxt"
        component={ImportTxtScreen}
        options={{ title: 'Importar Extrato' }}
      />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MainStack />
    </>
  );
};

const AppContent = ({ ready }) => {
  const { theme, isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
    },
  };

  // As telas leem o banco já na montagem (useFocusEffect), então esperar a
  // migração terminar evita exibir dados no formato antigo — e evita que uma
  // escrita do usuário seja sobrescrita pela migração em andamento.
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <LockGate>
      <MenuContext.Provider value={{ openMenu: () => setMenuOpen(true) }}>
        <View style={{ flex: 1 }}>
          <NavigationContainer ref={navigationRef} theme={navigationTheme}>
            <AppNavigator />
          </NavigationContainer>
          <SideMenu
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            onNavigate={(route) => {
              setMenuOpen(false);
              navigationRef.current?.navigate(route);
            }}
          />
        </View>
      </MenuContext.Provider>
    </LockGate>
  );
};

const App = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // O primeiro frame já sai com o fundo escuro (loading gates do
    // ThemeProvider/AppContent), então dá pra esconder a splash aqui mesmo.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initDatabase();
        await setupNotificationChannel();
        // O texto da notificação semanal é estático depois de agendada, então
        // reagendamos a cada abertura com os números atualizados.
        await refreshWeeklySummary();
      } catch (error) {
        console.error('Erro na inicialização:', error);
      } finally {
        // Mesmo com falha o app abre: a migração é idempotente e tenta de novo.
        setReady(true);
      }
    };
    bootstrap();
  }, []);

  return (
    <ThemeProvider>
      <AppContent ready={ready} />
    </ThemeProvider>
  );
};

const styles = StyleSheet.create({
  headerButton: {
    paddingHorizontal: 12,
  },
});

export default App;

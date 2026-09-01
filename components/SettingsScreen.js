import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { clearAllData } from '../database/database';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  getWeeklySummaryEnabled,
  setWeeklySummaryEnabled,
  cancelWeeklySummary,
} from '../utils/notifications';
import { refreshWeeklySummary } from '../utils/weeklySummary';
import Constants from 'expo-constants';
import { getSecurityState } from '../utils/security';

const APP_VERSION = Constants.expoConfig?.version || '—';

/**
 * Fica no escopo do módulo de propósito: declarada dentro de `SettingsScreen`,
 * viraria um tipo novo a cada render e o React remontaria a lista inteira —
 * cortando a animação dos Switches ao alternar qualquer ajuste.
 */
const SettingRow = ({ theme, styles, icon, title, subtitle, onPress, rightComponent }) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
    <View style={styles.settingLeft}>
      <Ionicons name={icon} size={24} color={theme.primary} />
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {rightComponent ||
      (!!onPress && <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />)}
  </TouchableOpacity>
);

const SettingsScreen = ({ navigation }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);

  const styles = createStyles(theme);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [reminders, weekly, security] = await Promise.all([
          getNotificationsEnabled(),
          getWeeklySummaryEnabled(),
          getSecurityState(),
        ]);
        setRemindersEnabled(reminders);
        setWeeklyEnabled(weekly);
        setLockEnabled(security.lockEnabled);
      };
      load();
    }, [])
  );

  const handleToggleReminders = async (value) => {
    setRemindersEnabled(value);
    await setNotificationsEnabled(value);

    // O resumo semanal depende das notificações estarem ligadas.
    if (!value) await cancelWeeklySummary();
    else if (weeklyEnabled) await refreshWeeklySummary();
  };

  const handleToggleWeekly = async (value) => {
    setWeeklyEnabled(value);
    await setWeeklySummaryEnabled(value);

    if (value) {
      await refreshWeeklySummary();
      if (!remindersEnabled) {
        Alert.alert(
          'Lembretes desativados',
          'Ative "Lembretes" para receber o resumo semanal.'
        );
      }
    } else {
      await cancelWeeklySummary();
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Limpar Dados',
      'Isso apagará permanentemente todas as transações, contas, carteiras, orçamentos e metas. Esta ação não pode ser desfeita. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Sucesso', 'Todos os dados foram apagados.');
            } catch (error) {
              Alert.alert('Erro', 'Falha ao limpar dados.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aparência</Text>

        <SettingRow
          theme={theme}
          styles={styles}
          icon="moon"
          title="Tema Escuro"
          subtitle={isDark ? 'Ativado' : 'Desativado'}
          rightComponent={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={isDark ? '#fff' : '#f4f3f4'}
            />
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Planejamento</Text>

        <SettingRow
          theme={theme}
          styles={styles}
          icon="layers"
          title="Planejamento"
          subtitle="Orçamentos, metas e carteiras"
          onPress={() => navigation.navigate('Planning')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Segurança</Text>

        <SettingRow
          theme={theme}
          styles={styles}
          icon="lock-closed"
          title="Bloqueio do App"
          subtitle={lockEnabled ? 'PIN e biometria ativos' : 'Desativado'}
          onPress={() => navigation.navigate('Security')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados</Text>

        <SettingRow
          theme={theme}
          styles={styles}
          icon="cloud-upload"
          title="Backup"
          subtitle="Fazer backup dos dados"
          onPress={() => navigation.navigate('Backup')}
        />

        <SettingRow
          theme={theme}
          styles={styles}
          icon="document-text"
          title="Importar Extrato"
          subtitle="Lançamentos de um arquivo TXT"
          onPress={() => navigation.navigate('ImportTxt')}
        />

        <SettingRow
          theme={theme}
          styles={styles}
          icon="trash"
          title="Limpar Dados"
          subtitle="Apagar todas as informações"
          onPress={handleClearData}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificações</Text>

        <SettingRow
          theme={theme}
          styles={styles}
          icon="notifications"
          title="Lembretes"
          subtitle={remindersEnabled ? 'Ativados' : 'Desativados'}
          rightComponent={
            <Switch
              value={remindersEnabled}
              onValueChange={handleToggleReminders}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={remindersEnabled ? '#fff' : '#f4f3f4'}
            />
          }
        />

        <SettingRow
          theme={theme}
          styles={styles}
          icon="stats-chart"
          title="Resumo Semanal"
          subtitle={weeklyEnabled ? 'Todo domingo às 20h' : 'Desativado'}
          rightComponent={
            <Switch
              value={weeklyEnabled}
              onValueChange={handleToggleWeekly}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={weeklyEnabled ? '#fff' : '#f4f3f4'}
            />
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre</Text>

        <SettingRow
          theme={theme}
          styles={styles}
          icon="information-circle"
          title="Versão"
          subtitle={APP_VERSION}
        />
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 15,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
});

export default SettingsScreen;

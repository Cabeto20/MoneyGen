import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { clearChatHistory } from '../utils/chatHistory';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../utils/responsive';
import {
  clearAllData,
  cancelAllBillNotifications,
  rescheduleAllBillNotifications,
} from '../database/database';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  getWeeklySummaryEnabled,
  setWeeklySummaryEnabled,
  cancelWeeklySummary,
  getReminderMoments,
  setReminderMoments,
  REMINDER_MOMENTS,
  DEFAULT_REMINDER_MOMENTS,
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
const SettingRow = ({ theme, styles, icon, title, subtitle, onPress, rightComponent }) => {
  const r = useResponsive();

  return (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={r.font(24)} color={theme.primary} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent ||
        (!!onPress && <Ionicons name="chevron-forward" size={r.font(20)} color={theme.textSecondary} />)}
    </TouchableOpacity>
  );
};

const SettingsScreen = ({ navigation }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const r = useResponsive();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [togglingReminders, setTogglingReminders] = useState(false);
  const [reminderTimes, setReminderTimes] = useState(DEFAULT_REMINDER_MOMENTS);
  // Guarda qual horário está reagendando, para travar só aquele Switch.
  const [togglingMoment, setTogglingMoment] = useState(null);

  const styles = createStyles(theme, r);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [reminders, weekly, security, moments] = await Promise.all([
          getNotificationsEnabled(),
          getWeeklySummaryEnabled(),
          getSecurityState(),
          getReminderMoments(),
        ]);
        setRemindersEnabled(reminders);
        setWeeklyEnabled(weekly);
        setLockEnabled(security.lockEnabled);
        setReminderTimes(moments);
      };
      load();
    }, [])
  );

  /**
   * Liga/desliga um horário de lembrete.
   *
   * Reagenda tudo depois de salvar: o ajuste sozinho só valeria para contas
   * criadas daqui pra frente, e o que já está na fila do Android continuaria
   * disparando no horário antigo.
   */
  const handleToggleMoment = async (key, value) => {
    if (togglingMoment) return;

    const next = { ...reminderTimes, [key]: value };
    setTogglingMoment(key);
    setReminderTimes(next);

    try {
      await setReminderMoments(next);
      if (remindersEnabled) await rescheduleAllBillNotifications();
    } finally {
      setTogglingMoment(null);
    }
  };

  const handleToggleReminders = async (value) => {
    if (togglingReminders) return;

    setTogglingReminders(true);
    setRemindersEnabled(value);

    try {
      await setNotificationsEnabled(value);

      // O ajuste só barra agendamentos novos: os lembretes já na fila do
      // sistema precisam ser cancelados aqui, senão continuam disparando
      // depois de desligados. Ao religar, reagenda o que ficou para trás.
      if (value) await rescheduleAllBillNotifications();
      else await cancelAllBillNotifications();

      // O resumo semanal depende das notificações estarem ligadas.
      if (!value) await cancelWeeklySummary();
      else if (weeklyEnabled) await refreshWeeklySummary();
    } finally {
      setTogglingReminders(false);
    }
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
              // clearAllData só conhece as 5 coleções do schema. Sem esta
              // linha, o assistente continuaria citando contas apagadas.
              await clearChatHistory();
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
        <Text style={styles.sectionTitle}>Assistente</Text>

        <SettingRow
          theme={theme}
          styles={styles}
          icon="bulb"
          title="O que ele aprendeu"
          subtitle="Frases que você ensinou e o que mais pergunta"
          onPress={() => navigation.navigate('AssistantMemory')}
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
              disabled={togglingReminders}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={remindersEnabled ? '#fff' : '#f4f3f4'}
            />
          }
        />

        {/* Quando avisar de cada conta. Ficam desabilitados junto com o
            interruptor geral: sem lembretes, o horário não muda nada. */}
        {REMINDER_MOMENTS.map((moment) => (
          <SettingRow
            key={moment.key}
            theme={theme}
            styles={styles}
            icon="alarm"
            title={moment.label}
            subtitle={moment.detail}
            rightComponent={
              <Switch
                value={!!reminderTimes[moment.key]}
                onValueChange={(value) => handleToggleMoment(moment.key, value)}
                disabled={!remindersEnabled || togglingMoment !== null}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={reminderTimes[moment.key] ? '#fff' : '#f4f3f4'}
              />
            }
          />
        ))}

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

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  section: {
    marginTop: r.space(20),
  },
  sectionTitle: {
    fontSize: r.font(16),
    fontWeight: 'bold',
    color: theme.primary,
    marginHorizontal: r.gutter,
    marginBottom: r.space(10),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: r.gutter,
    paddingVertical: r.space(15),
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
    marginLeft: r.space(15),
    flex: 1,
  },
  settingTitle: {
    fontSize: r.font(16),
    color: theme.text,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: r.font(14),
    color: theme.textSecondary,
    marginTop: r.space(2),
  },
});

export default SettingsScreen;

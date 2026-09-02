import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clampToMonth } from './billHelpers';

// Configurar comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
const WEEKLY_SUMMARY_ENABLED_KEY = 'weeklySummaryEnabled';
const WEEKLY_SUMMARY_ID_KEY = 'weeklySummaryNotificationId';

const CHANNEL_ID = 'moneygen-reminders';

/**
 * Sem um canal explícito o Android joga os lembretes no canal padrão de baixa
 * importância, onde eles não emitem som nem aparecem como banner.
 */
export const setupNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Lembretes financeiros',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  } catch (error) {
    console.error('Erro ao criar canal de notificação:', error);
  }
};

export const getNotificationsEnabled = async () => {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return value === null ? true : value === 'true';
  } catch (error) {
    return true;
  }
};

export const setNotificationsEnabled = async (enabled) => {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
};

export const getWeeklySummaryEnabled = async () => {
  try {
    return (await AsyncStorage.getItem(WEEKLY_SUMMARY_ENABLED_KEY)) === 'true';
  } catch (error) {
    return false;
  }
};

export const setWeeklySummaryEnabled = async (enabled) => {
  await AsyncStorage.setItem(WEEKLY_SUMMARY_ENABLED_KEY, String(enabled));
};

export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(WEEKLY_SUMMARY_ID_KEY);
  } catch (error) {
    console.error('Erro ao cancelar todas as notificações:', error);
  }
};

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

/** Portão comum: respeita o ajuste do usuário e a permissão do sistema. */
const canSchedule = async () => {
  if (!(await getNotificationsEnabled())) return false;
  return requestNotificationPermissions();
};

/**
 * Próxima data de vencimento da conta. Contas únicas e parcelas têm data
 * própria em `dueDate`; as fixas usam o dia do mês, pulando para o mês seguinte
 * se o dia já passou.
 */
const resolveDueDate = (bill) => {
  if (bill.billType !== 'fixa' && bill.dueDate) {
    return new Date(bill.dueDate);
  }

  const today = new Date();
  // O dia é limitado ao último do mês: sem isso o dia 31 de uma conta fixa
  // estoura para o mês seguinte e o lembrete sai dias depois do vencimento.
  const dueDate = clampToMonth(bill.dueDay, today.getMonth(), today.getFullYear());

  if (dueDate <= today) {
    return clampToMonth(bill.dueDay, today.getMonth() + 1, today.getFullYear());
  }
  return dueDate;
};

const formatAmount = (amount) =>
  amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * O `trigger` precisa ser um objeto tipado — passar um `Date` cru lança
 * TypeError desde o expo-notifications 0.29.
 */
const scheduleAt = async (date, content) => {
  if (date <= new Date()) return null;

  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL_ID,
    },
  });
};

export const scheduleNotificationForBill = async (bill) => {
  try {
    if (!(await canSchedule())) return null;

    const dueDate = resolveDueDate(bill);
    dueDate.setHours(9, 0, 0, 0);

    return await scheduleAt(dueDate, {
      title: '💳 Conta a Vencer',
      body: `${bill.description} - ${formatAmount(bill.amount)}`,
      data: { billId: bill.id, type: 'bill_due' },
    });
  } catch (error) {
    console.error('Erro ao agendar notificação:', error);
    return null;
  }
};

export const scheduleMidnightNotification = async (bill) => {
  try {
    if (!(await canSchedule())) return null;

    const dueDate = resolveDueDate(bill);
    dueDate.setHours(0, 0, 0, 0);

    return await scheduleAt(dueDate, {
      title: '🌙 Conta Vence Hoje!',
      body: `${bill.description} - ${formatAmount(bill.amount)}`,
      data: { billId: bill.id, type: 'bill_midnight' },
    });
  } catch (error) {
    console.error('Erro ao agendar notificação da meia-noite:', error);
    return null;
  }
};

export const scheduleReminderForBill = async (bill, daysBefore = 1) => {
  try {
    if (!(await canSchedule())) return null;

    const reminderDate = resolveDueDate(bill);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    reminderDate.setHours(18, 0, 0, 0);

    return await scheduleAt(reminderDate, {
      title: '⏰ Lembrete de Conta',
      body: `${bill.description} vence ${daysBefore === 1 ? 'amanhã' : `em ${daysBefore} dias`}`,
      data: { billId: bill.id, type: 'bill_reminder' },
    });
  } catch (error) {
    console.error('Erro ao agendar lembrete:', error);
    return null;
  }
};

export const cancelNotificationForBill = async (notificationId) => {
  try {
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  } catch (error) {
    console.error('Erro ao cancelar notificação:', error);
  }
};

export const cancelWeeklySummary = async () => {
  try {
    const notificationId = await AsyncStorage.getItem(WEEKLY_SUMMARY_ID_KEY);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(WEEKLY_SUMMARY_ID_KEY);
    }
  } catch (error) {
    console.error('Erro ao cancelar resumo semanal:', error);
  }
};

/**
 * Agenda o resumo semanal (domingo, 20h). O conteúdo de uma notificação
 * agendada é fixo, então quem chama recalcula os números e reagenda a cada
 * abertura do app — ver `utils/weeklySummary.js`.
 */
export const scheduleWeeklySummary = async (body) => {
  try {
    await cancelWeeklySummary();

    if (!(await getWeeklySummaryEnabled())) return null;
    if (!(await canSchedule())) return null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Resumo da Semana',
        body,
        data: { type: 'weekly_summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // domingo
        hour: 20,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });

    await AsyncStorage.setItem(WEEKLY_SUMMARY_ID_KEY, notificationId);
    return notificationId;
  } catch (error) {
    console.error('Erro ao agendar resumo semanal:', error);
    return null;
  }
};

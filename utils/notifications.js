import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
};

export const scheduleNotificationForBill = async (bill) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    let dueDate;
    
    if (bill.billType === 'unica' && bill.dueDate) {
      dueDate = new Date(bill.dueDate);
    } else {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      dueDate = new Date(currentYear, currentMonth, bill.dueDay);
      
      if (dueDate <= today) {
        dueDate = new Date(currentYear, currentMonth + 1, bill.dueDay);
      }
    }
    
    if (dueDate <= new Date()) return null;
    
    dueDate.setHours(9, 0, 0, 0);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💳 Conta a Vencer',
        body: `${bill.description} - ${bill.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        data: { billId: bill.id, type: 'bill_due' },
      },
      trigger: dueDate,
    });
    
    return notificationId;
  } catch (error) {
    console.error('Erro ao agendar notificação:', error);
    return null;
  }
};

export const scheduleMidnightNotification = async (bill) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    let dueDate;
    
    if (bill.billType === 'unica' && bill.dueDate) {
      dueDate = new Date(bill.dueDate);
    } else {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      dueDate = new Date(currentYear, currentMonth, bill.dueDay);
      
      if (dueDate <= today) {
        dueDate = new Date(currentYear, currentMonth + 1, bill.dueDay);
      }
    }
    
    if (dueDate <= new Date()) return null;
    
    dueDate.setHours(0, 0, 0, 0);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 Conta Vence Hoje!',
        body: `${bill.description} - ${bill.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        data: { billId: bill.id, type: 'bill_midnight' },
      },
      trigger: dueDate,
    });
    
    return notificationId;
  } catch (error) {
    console.error('Erro ao agendar notificação da meia-noite:', error);
    return null;
  }
};

export const scheduleReminderForBill = async (bill, daysBefore = 1) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    let dueDate;
    
    if (bill.billType === 'unica' && bill.dueDate) {
      dueDate = new Date(bill.dueDate);
    } else {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      dueDate = new Date(currentYear, currentMonth, bill.dueDay);
      
      if (dueDate <= today) {
        dueDate = new Date(currentYear, currentMonth + 1, bill.dueDay);
      }
    }
    
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    reminderDate.setHours(18, 0, 0, 0);
    
    if (reminderDate <= new Date()) return null;
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Lembrete de Conta',
        body: `${bill.description} vence ${daysBefore === 1 ? 'amanhã' : `em ${daysBefore} dias`}`,
        data: { billId: bill.id, type: 'bill_reminder' },
      },
      trigger: reminderDate,
    });
    
    return notificationId;
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
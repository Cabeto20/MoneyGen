import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  REMINDER_MOMENTS,
  DEFAULT_REMINDER_MOMENTS,
  getReminderMoments,
  setReminderMoments,
  scheduleBillReminders,
  setNotificationsEnabled,
} from '../notifications';

const bill = (overrides = {}) => ({
  id: 'b1',
  description: 'Energia',
  amount: 210,
  dueDay: 20,
  billType: 'fixa',
  paidMonths: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/** Datas dos agendamentos feitos, na ordem em que foram pedidos. */
const scheduledDates = () =>
  Notifications.scheduleNotificationAsync.mock.calls.map((call) => call[0].trigger.date);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await setNotificationsEnabled(true);
  Notifications.scheduleNotificationAsync.mockImplementation(async () => 'id-agendado');
});

describe('preferência de horários', () => {
  it('vem com os três horários ligados', async () => {
    expect(await getReminderMoments()).toEqual(DEFAULT_REMINDER_MOMENTS);
    expect(Object.keys(DEFAULT_REMINDER_MOMENTS).sort()).toEqual(
      ['dayBefore', 'evening', 'noon'].sort()
    );
  });

  it('salva e lê de volta', async () => {
    await setReminderMoments({ dayBefore: false, noon: true, evening: false });

    expect(await getReminderMoments()).toEqual({
      dayBefore: false,
      noon: true,
      evening: false,
    });
  });

  // Um horário acrescentado numa versão nova não pode ficar indefinido só
  // porque a preferência salva é anterior a ele.
  it('mescla com o padrão quando a preferência salva é antiga', async () => {
    await AsyncStorage.setItem('billReminderMoments', JSON.stringify({ dayBefore: false }));

    const moments = await getReminderMoments();
    expect(moments.dayBefore).toBe(false);
    expect(moments.noon).toBe(true);
    expect(moments.evening).toBe(true);
  });

  it('não quebra com JSON corrompido', async () => {
    await AsyncStorage.setItem('billReminderMoments', 'nao e json');

    expect(await getReminderMoments()).toEqual(DEFAULT_REMINDER_MOMENTS);
  });
});

describe('agendamento nos horários escolhidos', () => {
  it('agenda um lembrete por horário ligado', async () => {
    const ids = await scheduleBillReminders(bill());

    expect(ids).toHaveLength(REMINDER_MOMENTS.length);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
  });

  it('respeita os horários pedidos: véspera 18h, dia 12h e dia 18h', async () => {
    await scheduleBillReminders(bill());
    const dates = scheduledDates();

    const [dayBefore, noon, evening] = dates;
    expect(dayBefore.getHours()).toBe(18);
    expect(noon.getHours()).toBe(12);
    expect(evening.getHours()).toBe(18);

    // A véspera cai um dia antes dos outros dois, que são no vencimento.
    expect(noon.getDate()).toBe(evening.getDate());
    expect(dayBefore.getTime()).toBeLessThan(noon.getTime());
  });

  it('desligar um horário deixa de agendar aquele lembrete', async () => {
    await setReminderMoments({ dayBefore: false, noon: true, evening: false });

    const ids = await scheduleBillReminders(bill());

    expect(ids).toHaveLength(1);
    expect(scheduledDates()[0].getHours()).toBe(12);
  });

  it('com todos desligados não agenda nada', async () => {
    await setReminderMoments({ dayBefore: false, noon: false, evening: false });

    expect(await scheduleBillReminders(bill())).toEqual([]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // O ajuste geral continua sendo o portão: desligado, nada é agendado
  // independentemente dos horários marcados.
  it('lembretes desligados no geral barram tudo', async () => {
    await setNotificationsEnabled(false);

    expect(await scheduleBillReminders(bill())).toEqual([]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('não agenda no passado', async () => {
    // Conta fixa cujo vencimento já passou neste mês rola para o mês que vem,
    // então os três continuam no futuro — o filtro de passado age por horário.
    const ids = await scheduleBillReminders(bill({ dueDay: 1 }));

    scheduledDates().forEach((date) => {
      expect(date.getTime()).toBeGreaterThan(Date.now());
    });
    expect(ids.length).toBeGreaterThan(0);
  });

  it('o corpo da mensagem cita a conta e o valor', async () => {
    await scheduleBillReminders(bill());
    const { content } = Notifications.scheduleNotificationAsync.mock.calls[0][0];

    expect(content.body).toContain('Energia');
    expect(content.body).toContain('210');
    expect(content.data.billId).toBe('b1');
  });
});

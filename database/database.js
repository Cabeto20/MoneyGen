import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cancelNotificationForBill,
  cancelAllNotifications,
  scheduleNotificationForBill,
  scheduleReminderForBill,
  scheduleMidnightNotification,
} from '../utils/notifications';
import { generateId, initDeviceId } from '../utils/id';
import {
  monthKey,
  getTransactionDate,
  formatDateBR,
  isSameMonth,
  addMonthsToDate,
} from '../utils/dateHelpers';
import {
  isBillPaidForMonth,
  getBillPaymentMonthKey,
  getBillOccurrence,
  getBillDueDateFor,
  filterBillsByMonth,
} from '../utils/billHelpers';
import { ACCOUNT_TYPE_MAP } from '../utils/categories';

const TRANSACTIONS_KEY = 'transactions';
const BILLS_KEY = 'bills';
const ACCOUNTS_KEY = 'accounts';
const BUDGETS_KEY = 'budgets';
const GOALS_KEY = 'goals';
const SCHEMA_VERSION_KEY = 'schemaVersion';
const PRE_V3_BACKUP_KEY = 'backupPreV3';

const SCHEMA_VERSION = 3;
export const DEFAULT_ACCOUNT_ID = 'acc-default';

// Registro excluído vira lápide (`deletedAt`) em vez de sumir do array: sem
// isso, o aparelho que não viu a exclusão ressuscita o registro ao fundir os
// dados. A lápide é podada depois deste prazo, senão o storage cresce sem fim.
const TOMBSTONE_TTL_DAYS = 90;

const readCollection = async (key) => {
  try {
    const data = await AsyncStorage.getItem(key);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writeCollection = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

/** Só os registros vivos. As telas leem por aqui e não enxergam lápides. */
const readActive = async (key) => (await readCollection(key)).filter(isActive);

export const isActive = (record) => !record?.deletedAt;

/**
 * Carimba o instante da última alteração. É o que permite decidir qual versão
 * de um registro vence quando celular e tablet editarem o mesmo item.
 */
const touch = (record) => ({ ...record, updatedAt: new Date().toISOString() });

/** Marca como excluído em vez de remover, preservando a lápide para o sync. */
const tombstone = (record) => ({
  ...record,
  deletedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// Migrações
// ---------------------------------------------------------------------------

const buildDefaultAccount = () => ({
  id: DEFAULT_ACCOUNT_ID,
  name: 'Carteira Principal',
  type: 'dinheiro',
  initialBalance: 0,
  archived: false,
  createdAt: new Date().toISOString(),
});

/**
 * v1 guardava `isPaid` como booleano único por conta. Isso quebrava contas
 * fixas: quitar o mês corrente marcava a conta como paga em todos os meses
 * seguintes. A v2 registra a competência paga em `paidMonths`.
 */
const migrateBillToV2 = (bill) => {
  if (Array.isArray(bill.paidMonths)) {
    const { isPaid, ...rest } = bill;
    return { accountId: DEFAULT_ACCOUNT_ID, ...rest };
  }

  let paidMonths = [];
  if (bill.isPaid) {
    const occurrence = getBillOccurrence(bill);
    if (occurrence) {
      paidMonths = [monthKey(occurrence.month, occurrence.year)];
    } else {
      // Conta fixa: não dá para saber a competência quitada, assume o mês atual.
      const today = new Date();
      paidMonths = [monthKey(today.getMonth(), today.getFullYear())];
    }
  }

  const { isPaid, ...rest } = bill;
  return {
    ...rest,
    paidMonths,
    accountId: bill.accountId || DEFAULT_ACCOUNT_ID,
    notificationsEnabled: bill.notificationsEnabled !== false,
  };
};

const migrateTransactionToV2 = (transaction) => {
  if (transaction.dateISO && transaction.accountId) return transaction;

  const parsed = getTransactionDate(transaction);
  return {
    ...transaction,
    accountId: transaction.accountId || DEFAULT_ACCOUNT_ID,
    dateISO: transaction.dateISO || (parsed ? parsed.toISOString() : new Date().toISOString()),
  };
};

/** Normaliza dados carregados (de storage ou de um backup antigo) para a v2. */
export const migrateData = ({ transactions = [], bills = [], accounts = [] }) => ({
  accounts: accounts.length > 0 ? accounts : [buildDefaultAccount()],
  transactions: transactions.map(migrateTransactionToV2),
  bills: bills.map(migrateBillToV2),
});

/**
 * A v3 prepara os dados para sincronizar entre aparelhos: todo registro passa a
 * ter `updatedAt` (para desempatar edições) e a exclusão vira lápide. Os ids
 * numéricos antigos são mantidos de propósito — o tablet é semeado com um
 * backup do celular, então esses registros chegam com o mesmo id nos dois
 * lados, que é justamente o que a fusão precisa para reconhecê-los.
 */
const migrateRecordToV3 = (record, fallbackDate) => {
  if (record.updatedAt) return record;
  return { ...record, updatedAt: record.createdAt || fallbackDate || new Date().toISOString() };
};

/** A v2 guardava `{ categoria: limite }`; a v3 precisa de espaço para metadados. */
export const migrateBudgetsToV3 = (budgets) =>
  Object.entries(budgets || {}).reduce((map, [category, value]) => {
    if (value && typeof value === 'object') return { ...map, [category]: value };
    return {
      ...map,
      [category]: { limit: value, updatedAt: new Date().toISOString() },
    };
  }, {});

/** Remove de vez as lápides velhas o bastante para já terem sido propagadas. */
const pruneTombstones = (records) => {
  const cutoff = Date.now() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return records.filter(record => {
    if (!record.deletedAt) return true;
    const deletedTime = new Date(record.deletedAt).getTime();
    return Number.isNaN(deletedTime) || deletedTime > cutoff;
  });
};

export const initDatabase = async () => {
  try {
    // Antes de tudo: `generateId` é síncrona e depende deste valor em memória.
    await initDeviceId();

    const storedVersion = parseInt(await AsyncStorage.getItem(SCHEMA_VERSION_KEY), 10) || 1;

    if (storedVersion >= SCHEMA_VERSION) {
      await pruneAllTombstones();
      return;
    }

    // Retrato do estado anterior antes de reescrever qualquer coisa. É a
    // primeira migração que mexe em lançamento já feito — se algo der errado,
    // os dados originais continuam recuperáveis nesta chave.
    await AsyncStorage.setItem(
      PRE_V3_BACKUP_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        fromVersion: storedVersion,
        transactions: await readCollection(TRANSACTIONS_KEY),
        bills: await readCollection(BILLS_KEY),
        accounts: await readCollection(ACCOUNTS_KEY),
        goals: await readCollection(GOALS_KEY),
        budgets: JSON.parse((await AsyncStorage.getItem(BUDGETS_KEY)) || '{}'),
      })
    );

    // v1 -> v2 (carteiras e competência de pagamento) continua valendo para
    // quem pulou a versão; quem já está na v2 passa direto por ela.
    const migrated = migrateData({
      transactions: await readCollection(TRANSACTIONS_KEY),
      bills: await readCollection(BILLS_KEY),
      accounts: await readCollection(ACCOUNTS_KEY),
    });

    await writeCollection(
      ACCOUNTS_KEY,
      migrated.accounts.map(account => migrateRecordToV3(account))
    );
    await writeCollection(
      TRANSACTIONS_KEY,
      migrated.transactions.map(t => migrateRecordToV3(t, t.dateISO))
    );
    await writeCollection(
      BILLS_KEY,
      migrated.bills.map(bill => migrateRecordToV3(bill))
    );
    await writeCollection(
      GOALS_KEY,
      (await readCollection(GOALS_KEY)).map(goal => migrateRecordToV3(goal))
    );
    await AsyncStorage.setItem(
      BUDGETS_KEY,
      JSON.stringify(migrateBudgetsToV3(await readRawBudgets()))
    );

    await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
  } catch (error) {
    console.error('Erro ao migrar banco de dados:', error);
  }
};

const pruneAllTombstones = async () => {
  for (const key of [TRANSACTIONS_KEY, BILLS_KEY, ACCOUNTS_KEY, GOALS_KEY]) {
    const records = await readCollection(key);
    const pruned = pruneTombstones(records);
    if (pruned.length !== records.length) await writeCollection(key, pruned);
  }
};

// ---------------------------------------------------------------------------
// Contas / carteiras
// ---------------------------------------------------------------------------

export const getAccounts = async () => {
  const accounts = await readActive(ACCOUNTS_KEY);
  return accounts.length > 0 ? accounts : [buildDefaultAccount()];
};

export const getAccountsRaw = async () => readCollection(ACCOUNTS_KEY);

/**
 * Base para escrita: crua (preserva lápides) e com a carteira padrão
 * materializada quando não há nenhuma viva — os lançamentos apontam para ela.
 */
const accountsForWrite = async () => {
  const accounts = await getAccountsRaw();
  return accounts.some(isActive) ? accounts : [...accounts, buildDefaultAccount()];
};

export const addAccount = async ({ name, type = 'dinheiro', initialBalance = 0 }) => {
  const accounts = await accountsForWrite();
  const newAccount = touch({
    id: generateId(),
    name,
    type,
    initialBalance,
    archived: false,
    createdAt: new Date().toISOString(),
  });
  await writeCollection(ACCOUNTS_KEY, [...accounts, newAccount]);
  return newAccount;
};

export const updateAccount = async (accountId, fields) => {
  const accounts = await accountsForWrite();
  const updated = accounts.map(account =>
    account.id === accountId ? touch({ ...account, ...fields, id: account.id }) : account
  );
  await writeCollection(ACCOUNTS_KEY, updated);
};

/**
 * Remove a carteira e move as transações dela para outra, para que o histórico
 * não perca lançamentos. Falha se for a única carteira restante.
 */
export const deleteAccount = async (accountId) => {
  const accounts = await accountsForWrite();
  const active = accounts.filter(isActive);
  if (active.length <= 1) {
    throw new Error('É preciso manter ao menos uma carteira');
  }

  const removed = active.find(account => account.id === accountId);
  const fallback = active.find(account => account.id !== accountId);

  const transactions = await getTransactionsRaw();
  await writeCollection(
    TRANSACTIONS_KEY,
    transactions.map(t => (t.accountId === accountId ? touch({ ...t, accountId: fallback.id }) : t))
  );

  const bills = await getBillsRaw();
  await writeCollection(
    BILLS_KEY,
    bills.map(b => (b.accountId === accountId ? touch({ ...b, accountId: fallback.id }) : b))
  );

  // O saldo inicial da carteira removida vai junto com os lançamentos, senão
  // o patrimônio total encolheria sem que nada tenha sido gasto.
  const mergedInitialBalance =
    (fallback.initialBalance || 0) + (removed?.initialBalance || 0);

  await writeCollection(
    ACCOUNTS_KEY,
    accounts.map(account => {
      if (account.id === accountId) return tombstone(account);
      if (account.id === fallback.id) {
        return touch({ ...account, initialBalance: mergedInitialBalance });
      }
      return account;
    })
  );

  return { ...fallback, initialBalance: mergedInitialBalance };
};

/** Saldo por carteira: saldo inicial + receitas - despesas lançadas nela. */
export const getAccountBalances = async () => {
  const [accounts, transactions] = await Promise.all([getAccounts(), getTransactions()]);

  return accounts.map(account => {
    const owned = transactions.filter(t => (t.accountId || DEFAULT_ACCOUNT_ID) === account.id);
    const income = owned
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = owned
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      ...account,
      meta: ACCOUNT_TYPE_MAP[account.type] || ACCOUNT_TYPE_MAP.dinheiro,
      income,
      expense,
      transactionCount: owned.length,
      balance: (account.initialBalance || 0) + income - expense,
    };
  });
};

// ---------------------------------------------------------------------------
// Transações
// ---------------------------------------------------------------------------

export const addTransaction = async (
  description,
  amount,
  type,
  category = '',
  options = {}
) => {
  try {
    const transactions = await getTransactionsRaw();
    const date = options.date ? new Date(options.date) : new Date();

    const newTransaction = touch({
      id: generateId(),
      description,
      amount,
      type,
      category,
      accountId: options.accountId || DEFAULT_ACCOUNT_ID,
      date: formatDateBR(date),
      dateISO: date.toISOString(),
      ...(options.billId !== undefined && { billId: options.billId }),
      ...(options.billMonthKey !== undefined && { billMonthKey: options.billMonthKey }),
    });

    await writeCollection(TRANSACTIONS_KEY, [newTransaction, ...transactions]);
    return newTransaction;
  } catch (error) {
    console.error('Erro ao adicionar transação:', error);
    throw error;
  }
};

/** Timestamp de uma transação para ordenação; 0 quando a data é ilegível. */
const transactionTime = (transaction) => {
  const date = getTransactionDate(transaction);
  return date ? date.getTime() : 0;
};

/**
 * Insere vários lançamentos de uma vez (importação de extrato). Uma única
 * escrita no storage — gravar um por um com `addTransaction` relê e reescreve
 * a coleção inteira a cada item, o que fica lento e pode perder itens se duas
 * escritas se cruzarem.
 */
export const addTransactionsBulk = async (items, accountId = DEFAULT_ACCOUNT_ID) => {
  try {
    const transactions = await getTransactionsRaw();

    const imported = items.map(item => {
      const date = item.date instanceof Date ? item.date : new Date(item.date);
      return touch({
        id: generateId(),
        description: item.description,
        amount: item.amount,
        type: item.type,
        category: item.category || '',
        accountId: item.accountId || accountId,
        date: formatDateBR(date),
        dateISO: date.toISOString(),
      });
    });

    // A coleção é lida na ordem em que foi gravada (a Home mostra os 5
    // primeiros como "últimas transações"), então reordena por data: sem isso
    // um extrato antigo importado empurraria os lançamentos recentes para
    // baixo. O sort é estável, então empate mantém o importado na frente.
    const merged = [...imported, ...transactions];
    merged.sort((a, b) => transactionTime(b) - transactionTime(a));

    await writeCollection(TRANSACTIONS_KEY, merged);
    return imported;
  } catch (error) {
    console.error('Erro ao importar transações:', error);
    throw error;
  }
};

export const updateTransaction = async (transactionId, fields) => {
  try {
    const transactions = await getTransactionsRaw();
    const updated = transactions.map(t => {
      if (t.id !== transactionId) return t;

      const next = { ...t, ...fields, id: t.id };
      if (fields.date instanceof Date) {
        next.date = formatDateBR(fields.date);
        next.dateISO = fields.date.toISOString();
      }
      return touch(next);
    });

    await writeCollection(TRANSACTIONS_KEY, updated);
  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    throw error;
  }
};

export const getTransactions = async () => readActive(TRANSACTIONS_KEY);

/** Inclui os excluídos. Só backup e sincronização usam. */
export const getTransactionsRaw = async () => readCollection(TRANSACTIONS_KEY);

export const deleteTransaction = async (transactionId) => {
  try {
    const transactions = await getTransactionsRaw();
    const target = transactions.find(t => t.id === transactionId);

    await writeCollection(
      TRANSACTIONS_KEY,
      transactions.map(t => (t.id === transactionId ? tombstone(t) : t))
    );

    // A despesa nasceu de uma conta quitada: reabrir a competência para não
    // deixar a conta marcada como paga sem lançamento correspondente.
    if (target?.billId !== undefined && target?.billMonthKey) {
      const bills = await getBillsRaw();
      await writeCollection(
        BILLS_KEY,
        bills.map(bill =>
          bill.id === target.billId
            ? touch({
                ...bill,
                paidMonths: (bill.paidMonths || []).filter(m => m !== target.billMonthKey),
              })
            : bill
        )
      );
    }
  } catch (error) {
    console.error('Erro ao deletar transação:', error);
    throw error;
  }
};

export const getBalance = async (accountId = null) => {
  const [transactions, accounts] = await Promise.all([getTransactions(), getAccounts()]);

  const scopedTransactions = accountId
    ? transactions.filter(t => (t.accountId || DEFAULT_ACCOUNT_ID) === accountId)
    : transactions;
  const scopedAccounts = accountId
    ? accounts.filter(account => account.id === accountId)
    : accounts;

  const initial = scopedAccounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0);
  const income = scopedTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = scopedTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return { income, expense, balance: initial + income - expense };
};

export const getMonthlyBalance = async (month, year) => {
  const transactions = await getTransactions();
  const scoped = transactions.filter(t => isSameMonth(getTransactionDate(t), month, year));

  const income = scoped.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = scoped.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return { income, expense, balance: income - expense, count: scoped.length };
};

// ---------------------------------------------------------------------------
// Contas a pagar
// ---------------------------------------------------------------------------

export const addBill = async (
  description,
  amount,
  dueDay,
  category = '',
  billType = 'fixa',
  installments = 1,
  dueDate = null,
  accountId = DEFAULT_ACCOUNT_ID
) => {
  try {
    const bills = await getBillsRaw();
    const createdAt = new Date().toISOString();

    const base = {
      amount,
      dueDay,
      category,
      billType,
      accountId,
      paidMonths: [],
      createdAt,
      notificationsEnabled: true,
    };

    if (billType === 'parcelada') {
      // Cada parcela carrega o próprio vencimento (1ª na data escolhida, as
      // demais mês a mês). Sem isso a ocorrência era derivada da data de
      // criação, jogando a parcela 1 para o mês errado.
      const firstDueDate = dueDate ? new Date(dueDate) : new Date(createdAt);

      const newBills = Array.from({ length: installments }, (_, index) => {
        const installmentDate = addMonthsToDate(firstDueDate, index);
        return touch({
          ...base,
          id: generateId(),
          description: `${description} (${index + 1}/${installments})`,
          dueDay: installmentDate.getDate(),
          dueDate: installmentDate.toISOString(),
          installmentNumber: index + 1,
          totalInstallments: installments,
        });
      });

      await writeCollection(BILLS_KEY, [...newBills, ...bills]);
      return newBills;
    }

    const newBill = touch({
      ...base,
      id: generateId(),
      description,
      dueDate: dueDate ? new Date(dueDate).toISOString() : createdAt,
    });

    await writeCollection(BILLS_KEY, [newBill, ...bills]);
    return newBill;
  } catch (error) {
    console.error('Erro ao adicionar conta:', error);
    throw error;
  }
};

/**
 * Insere várias contas de uma vez (importação de extrato). As saídas de um
 * extrato são lançamentos avulsos, então entram como `unica` com o vencimento
 * lido do arquivo. Os lembretes são agendados aqui: `scheduleAllBillNotifications`
 * devolve null para datas passadas, então extrato antigo não gera notificação.
 */
export const addBillsBulk = async (items, accountId = DEFAULT_ACCOUNT_ID) => {
  try {
    const bills = await getBillsRaw();
    const createdAt = new Date().toISOString();

    const imported = [];
    for (const item of items) {
      const dueDate = item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate);

      const bill = {
        id: generateId(),
        description: item.description,
        amount: item.amount,
        dueDay: dueDate.getDate(),
        dueDate: dueDate.toISOString(),
        category: item.category || '',
        billType: 'unica',
        accountId: item.accountId || accountId,
        paidMonths: [],
        createdAt,
        notificationsEnabled: true,
      };

      imported.push(touch({ ...bill, ...(await scheduleAllBillNotifications(bill)) }));
    }

    await writeCollection(BILLS_KEY, [...imported, ...bills]);
    return imported;
  } catch (error) {
    console.error('Erro ao importar contas:', error);
    throw error;
  }
};

export const updateBill = async (billId, fields) => {
  try {
    const bills = await getBillsRaw();
    const updated = bills.map(bill => {
      if (bill.id !== billId) return bill;

      const next = { ...bill, ...fields, id: bill.id };
      if (fields.dueDate instanceof Date) {
        next.dueDate = fields.dueDate.toISOString();
        next.dueDay = fields.dueDate.getDate();
      }
      return touch(next);
    });

    await writeCollection(BILLS_KEY, updated);
  } catch (error) {
    console.error('Erro ao atualizar conta:', error);
    throw error;
  }
};

export const getBills = async () => readActive(BILLS_KEY);

export const getBillsRaw = async () => readCollection(BILLS_KEY);

/**
 * Quita a conta na competência informada e lança a despesa correspondente.
 * Contas fixas podem ser quitadas uma vez por mês.
 */
export const markBillAsPaid = async (billId, selectedMonth = null, selectedYear = null) => {
  try {
    const bill = (await getBills()).find(b => b.id === billId);
    if (!bill) return;

    const today = new Date();
    const month = selectedMonth !== null ? selectedMonth : today.getMonth();
    const year = selectedYear !== null ? selectedYear : today.getFullYear();

    if (isBillPaidForMonth(bill, month, year)) return;

    const paymentMonthKey = getBillPaymentMonthKey(bill, month, year);

    // A despesa precisa cair na competência quitada, não no dia de hoje: quitar
    // julho em agosto deve aparecer no relatório e no orçamento de julho.
    const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
    const expenseDate = isCurrentMonth ? today : getBillDueDateFor(bill, month, year);

    await addTransaction(bill.description, bill.amount, 'expense', bill.category, {
      accountId: bill.accountId || DEFAULT_ACCOUNT_ID,
      billId: bill.id,
      billMonthKey: paymentMonthKey,
      date: expenseDate,
    });

    // Contas fixas seguem gerando ocorrências, então mantêm as notificações.
    if (bill.billType !== 'fixa') {
      await cancelBillNotifications(bill);
    }

    // Relê depois do await: outra quitação pode ter gravado nesse intervalo.
    const bills = await getBillsRaw();
    await writeCollection(
      BILLS_KEY,
      bills.map(b =>
        b.id === billId
          ? touch({
              ...b,
              paidMonths: [...new Set([...(b.paidMonths || []), paymentMonthKey])],
              ...(b.billType !== 'fixa' && {
                notificationId: null,
                reminderNotificationId: null,
                midnightNotificationId: null,
              }),
            })
          : b
      )
    );
  } catch (error) {
    console.error('Erro ao marcar conta como paga:', error);
    throw error;
  }
};

/** Desfaz a quitação de uma competência e remove a despesa gerada. */
export const unmarkBillAsPaid = async (billId, selectedMonth = null, selectedYear = null) => {
  try {
    const bill = (await getBills()).find(b => b.id === billId);
    if (!bill) return;

    const today = new Date();
    const month = selectedMonth !== null ? selectedMonth : today.getMonth();
    const year = selectedYear !== null ? selectedYear : today.getFullYear();
    const paymentMonthKey = getBillPaymentMonthKey(bill, month, year);

    // A quitação de contas não-recorrentes cancelou os lembretes; reabrir a
    // conta precisa reagendá-los, senão ela nunca mais avisa do vencimento.
    const reschedule =
      bill.billType !== 'fixa' ? await scheduleAllBillNotifications(bill) : {};

    const bills = await getBillsRaw();
    await writeCollection(
      BILLS_KEY,
      bills.map(b =>
        b.id === billId
          ? touch({
              ...b,
              ...reschedule,
              paidMonths: (b.paidMonths || []).filter(m => m !== paymentMonthKey),
            })
          : b
      )
    );

    const transactions = await getTransactionsRaw();
    const generated = transactions.filter(isActive).find(
      t => t.billId === billId && t.billMonthKey === paymentMonthKey
    );

    if (generated) {
      await writeCollection(
        TRANSACTIONS_KEY,
        transactions.map(t => (t.id === generated.id ? tombstone(t) : t))
      );
    }
  } catch (error) {
    console.error('Erro ao desfazer pagamento:', error);
    throw error;
  }
};

const cancelBillNotifications = async (bill) => {
  for (const id of [bill.notificationId, bill.reminderNotificationId, bill.midnightNotificationId]) {
    if (id) await cancelNotificationForBill(id);
  }
};

/** Agenda vencimento, lembrete e alerta da meia-noite; devolve os ids. */
export const scheduleAllBillNotifications = async (bill) => ({
  notificationId: await scheduleNotificationForBill(bill),
  reminderNotificationId: await scheduleReminderForBill(bill, 1),
  midnightNotificationId: await scheduleMidnightNotification(bill),
});

const CLEARED_NOTIFICATION_IDS = {
  notificationId: null,
  reminderNotificationId: null,
  midnightNotificationId: null,
};

/**
 * Descarta os ids agendados e reagenda os lembretes das contas ainda em aberto
 * no mês corrente. `scheduleAllBillNotifications` devolve null quando as
 * notificações estão desligadas ou a data já passou, então a lista volta
 * coerente nos dois casos.
 */
const withRescheduledNotifications = async (bills) => {
  const today = new Date();
  const result = [];

  for (const bill of bills) {
    // Conta excluída mantém a lápide intacta e não volta a avisar nada.
    if (!isActive(bill)) {
      result.push(bill);
      continue;
    }

    const stale = { ...bill, ...CLEARED_NOTIFICATION_IDS };
    const isPending = !isBillPaidForMonth(bill, today.getMonth(), today.getFullYear());
    result.push(isPending ? { ...stale, ...(await scheduleAllBillNotifications(bill)) } : stale);
  }

  return result;
};

/**
 * Cancela os lembretes de todas as contas. Usado ao desligar as notificações
 * nos ajustes: `canSchedule` só barra agendamentos novos, então sem isto os
 * lembretes já na fila do sistema continuariam disparando.
 */
export const cancelAllBillNotifications = async () => {
  const bills = await getBillsRaw();
  for (const bill of bills) await cancelBillNotifications(bill);

  await writeCollection(
    BILLS_KEY,
    bills.map(bill => (isActive(bill) ? { ...bill, ...CLEARED_NOTIFICATION_IDS } : bill))
  );
};

/** Reagenda os lembretes de todas as contas (ao religar as notificações). */
export const rescheduleAllBillNotifications = async () => {
  const bills = await getBillsRaw();
  for (const bill of bills) await cancelBillNotifications(bill);

  await writeCollection(BILLS_KEY, await withRescheduledNotifications(bills));
};

export const deleteBill = async (billId) => {
  try {
    const bills = await getBillsRaw();
    const bill = bills.find(b => b.id === billId);
    if (bill) await cancelBillNotifications(bill);

    await writeCollection(
      BILLS_KEY,
      bills.map(b => (b.id === billId ? tombstone(b) : b))
    );
  } catch (error) {
    console.error('Erro ao deletar conta:', error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Orçamentos por categoria
// ---------------------------------------------------------------------------

/**
 * Estrutura crua: `{ [categoria]: { limit, updatedAt, deletedAt? } }`. A v2
 * guardava só o número; `budgetEntry` aceita as duas formas para que um backup
 * antigo continue legível sem precisar migrar antes de ler.
 */
const readRawBudgets = async () => {
  try {
    const data = await AsyncStorage.getItem(BUDGETS_KEY);
    const parsed = data ? JSON.parse(data) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

/** Normaliza uma entrada de orçamento (número da v2 ou objeto da v3). */
const budgetEntry = (value) =>
  value && typeof value === 'object' ? value : { limit: value };

/** Mapa `{ [categoria]: limiteMensal }` só com os orçamentos vivos. */
export const getBudgets = async () => {
  const raw = await readRawBudgets();

  return Object.entries(raw).reduce((map, [category, value]) => {
    const entry = budgetEntry(value);
    if (entry.deletedAt || typeof entry.limit !== 'number') return map;
    return { ...map, [category]: entry.limit };
  }, {});
};

/** Estrutura completa, com lápides — usada pelo backup e pelo sync. */
export const getBudgetsRaw = readRawBudgets;

export const setBudget = async (category, limit) => {
  const raw = await readRawBudgets();

  await AsyncStorage.setItem(
    BUDGETS_KEY,
    // `deletedAt: null` reabre uma categoria que havia sido removida antes.
    JSON.stringify({
      ...raw,
      [category]: { limit, updatedAt: new Date().toISOString(), deletedAt: null },
    })
  );
};

export const deleteBudget = async (category) => {
  const raw = await readRawBudgets();
  if (!raw[category]) return;

  await AsyncStorage.setItem(
    BUDGETS_KEY,
    JSON.stringify({
      ...raw,
      [category]: {
        ...budgetEntry(raw[category]),
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  );
};

export const BUDGET_WARNING_THRESHOLD = 0.8;

/**
 * Consumo de cada orçamento no mês. `status` alimenta os alertas: 'exceeded'
 * quando estourou, 'warning' a partir de 80% do limite.
 */
export const getBudgetStatus = async (month = null, year = null) => {
  const today = new Date();
  const targetMonth = month !== null ? month : today.getMonth();
  const targetYear = year !== null ? year : today.getFullYear();

  const [budgets, transactions] = await Promise.all([getBudgets(), getTransactions()]);

  const spentByCategory = {};
  transactions.forEach(t => {
    if (t.type !== 'expense') return;
    if (!isSameMonth(getTransactionDate(t), targetMonth, targetYear)) return;

    const category = t.category || 'Outros';
    spentByCategory[category] = (spentByCategory[category] || 0) + t.amount;
  });

  return Object.entries(budgets)
    .map(([category, limit]) => {
      const spent = spentByCategory[category] || 0;
      const percent = limit > 0 ? spent / limit : 0;

      let status = 'ok';
      if (percent >= 1) status = 'exceeded';
      else if (percent >= BUDGET_WARNING_THRESHOLD) status = 'warning';

      return {
        category,
        limit,
        spent,
        remaining: limit - spent,
        percent,
        status,
      };
    })
    .sort((a, b) => b.percent - a.percent);
};

// ---------------------------------------------------------------------------
// Metas de economia
// ---------------------------------------------------------------------------

export const getGoals = async () => readActive(GOALS_KEY);

export const getGoalsRaw = async () => readCollection(GOALS_KEY);

export const addGoal = async ({
  name,
  targetAmount,
  savedAmount = 0,
  deadline = null,
  icon = 'flag',
  color = '#7c3aed',
}) => {
  const goals = await getGoalsRaw();
  const newGoal = touch({
    id: generateId(),
    name,
    targetAmount,
    savedAmount,
    deadline: deadline ? new Date(deadline).toISOString() : null,
    icon,
    color,
    deposits: savedAmount > 0
      ? [{ id: generateId(), amount: savedAmount, date: new Date().toISOString() }]
      : [],
    createdAt: new Date().toISOString(),
    completedAt: savedAmount >= targetAmount ? new Date().toISOString() : null,
  });

  await writeCollection(GOALS_KEY, [newGoal, ...goals]);
  return newGoal;
};

export const updateGoal = async (goalId, fields) => {
  const goals = await getGoalsRaw();
  const updated = goals.map(goal => {
    if (goal.id !== goalId) return goal;

    const next = { ...goal, ...fields, id: goal.id };
    if (fields.deadline !== undefined) {
      next.deadline = fields.deadline ? new Date(fields.deadline).toISOString() : null;
    }
    next.completedAt = next.savedAmount >= next.targetAmount
      ? goal.completedAt || new Date().toISOString()
      : null;
    return touch(next);
  });

  await writeCollection(GOALS_KEY, updated);
};

export const deleteGoal = async (goalId) => {
  const goals = await getGoalsRaw();
  await writeCollection(
    GOALS_KEY,
    goals.map(goal => (goal.id === goalId ? tombstone(goal) : goal))
  );
};

/**
 * Registra um aporte (ou resgate, com valor negativo) na meta. O total guardado
 * nunca fica negativo.
 */
export const addGoalDeposit = async (goalId, amount) => {
  const goals = await getGoalsRaw();

  const updated = goals.map(goal => {
    if (goal.id !== goalId) return goal;

    const savedAmount = Math.max(0, (goal.savedAmount || 0) + amount);
    return touch({
      ...goal,
      savedAmount,
      deposits: [
        { id: generateId(), amount, date: new Date().toISOString() },
        ...(goal.deposits || []),
      ],
      completedAt:
        savedAmount >= goal.targetAmount
          ? goal.completedAt || new Date().toISOString()
          : null,
    });
  });

  await writeCollection(GOALS_KEY, updated);
};

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

/**
 * Total de despesas por categoria. Sem argumentos considera todo o histórico;
 * com mês/ano restringe à competência.
 */
export const getTransactionsByCategory = async (month = null, year = null) => {
  const transactions = await getTransactions();
  const categories = {};

  transactions.forEach(t => {
    if (t.type !== 'expense') return;
    if (month !== null && !isSameMonth(getTransactionDate(t), month, year)) return;

    const cat = t.category || 'Outros';
    if (!categories[cat]) categories[cat] = { total: 0, count: 0 };
    categories[cat].total += t.amount;
    categories[cat].count += 1;
  });

  return Object.entries(categories)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);
};

export const getMonthlyStats = async (limit = 6) => {
  const transactions = await getTransactions();
  const months = {};

  transactions.forEach(t => {
    const date = getTransactionDate(t);
    if (!date) return;

    const key = monthKey(date.getMonth(), date.getFullYear());
    if (!months[key]) {
      months[key] = { key, month: date.getMonth(), year: date.getFullYear(), income: 0, expense: 0 };
    }

    if (t.type === 'income') months[key].income += t.amount;
    else months[key].expense += t.amount;
  });

  return Object.values(months)
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
    .slice(0, limit);
};

// ---------------------------------------------------------------------------
// Backup / exportação
// ---------------------------------------------------------------------------

export const clearAllData = async () => {
  await cancelAllNotifications();
  await AsyncStorage.multiRemove([
    TRANSACTIONS_KEY,
    BILLS_KEY,
    ACCOUNTS_KEY,
    BUDGETS_KEY,
    GOALS_KEY,
  ]);
  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
};

/**
 * Exporta a base crua, com `updatedAt` e lápides. Um backup que escondesse os
 * excluídos faria o aparelho que o restaurasse ressuscitar tudo que o outro
 * apagou — é justamente o que o schema v3 veio evitar.
 */
export const exportBackup = async () => ({
  transactions: await getTransactionsRaw(),
  bills: await getBillsRaw(),
  accounts: await getAccountsRaw(),
  budgets: await getBudgetsRaw(),
  goals: await getGoalsRaw(),
  exportDate: new Date().toISOString(),
  version: String(SCHEMA_VERSION),
});

const isValidTransaction = (t) =>
  t && typeof t === 'object' &&
  (typeof t.id === 'number' || typeof t.id === 'string') &&
  typeof t.description === 'string' &&
  typeof t.amount === 'number' &&
  (t.type === 'income' || t.type === 'expense');

const isValidBill = (b) =>
  b && typeof b === 'object' &&
  (typeof b.id === 'number' || typeof b.id === 'string') &&
  typeof b.description === 'string' &&
  typeof b.amount === 'number' &&
  typeof b.dueDay === 'number';

const isValidAccount = (a) =>
  a && typeof a === 'object' &&
  (typeof a.id === 'number' || typeof a.id === 'string') &&
  typeof a.name === 'string';

const isValidGoal = (g) =>
  g && typeof g === 'object' &&
  (typeof g.id === 'number' || typeof g.id === 'string') &&
  typeof g.name === 'string' &&
  typeof g.targetAmount === 'number';

// Backup v2 traz `{ categoria: 500 }`; v3 traz `{ categoria: { limit: 500 } }`.
const isValidBudgets = (budgets) =>
  budgets && typeof budgets === 'object' && !Array.isArray(budgets) &&
  Object.values(budgets).every(value =>
    typeof value === 'number' ||
    (!!value && typeof value === 'object' && typeof value.limit === 'number')
  );

export const importBackup = async (backupData) => {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Arquivo de backup inválido');
  }

  const checks = [
    ['transactions', isValidTransaction, 'Dados de transações inválidos no backup'],
    ['bills', isValidBill, 'Dados de contas inválidos no backup'],
    ['accounts', isValidAccount, 'Dados de carteiras inválidos no backup'],
    ['goals', isValidGoal, 'Dados de metas inválidos no backup'],
  ];

  checks.forEach(([field, validate, message]) => {
    const value = backupData[field];
    if (value !== undefined && (!Array.isArray(value) || !value.every(validate))) {
      throw new Error(message);
    }
  });

  if (backupData.budgets !== undefined && !isValidBudgets(backupData.budgets)) {
    throw new Error('Dados de orçamentos inválidos no backup');
  }

  // Backups da v1 não têm carteiras nem competências de pagamento.
  const migrated = migrateData({
    transactions: backupData.transactions || [],
    bills: backupData.bills || [],
    accounts: backupData.accounts || [],
  });

  // Os ids de notificação do backup vieram de outro aparelho (ou de outra
  // instalação) e não valem nada aqui: limpa a agenda antes de trocar os dados.
  await cancelAllNotifications();

  const hasBackupAccounts =
    Array.isArray(backupData.accounts) && backupData.accounts.length > 0;

  // Backup v1/v2 não tem `updatedAt`; sem ele a fusão não sabe desempatar.
  const stamp = (records, dateField) =>
    records.map(record => migrateRecordToV3(record, dateField && record[dateField]));

  if (hasBackupAccounts) {
    await writeCollection(ACCOUNTS_KEY, stamp(backupData.accounts));
  } else if (backupData.transactions || backupData.bills) {
    // Backup sem carteiras: os lançamentos migrados apontam para a padrão, que
    // precisa existir. As carteiras já cadastradas são preservadas.
    const current = await getAccountsRaw();
    if (!current.some(account => account.id === DEFAULT_ACCOUNT_ID)) {
      await writeCollection(ACCOUNTS_KEY, stamp([...current, buildDefaultAccount()]));
    } else {
      await writeCollection(ACCOUNTS_KEY, stamp(current));
    }
  }

  if (backupData.transactions) {
    await writeCollection(TRANSACTIONS_KEY, stamp(migrated.transactions, 'dateISO'));
  }

  if (backupData.bills) {
    // Reagenda os lembretes das contas ainda em aberto, com ids deste aparelho.
    await writeCollection(
      BILLS_KEY,
      stamp(await withRescheduledNotifications(migrated.bills))
    );
  }

  if (backupData.budgets) {
    await AsyncStorage.setItem(
      BUDGETS_KEY,
      JSON.stringify(migrateBudgetsToV3(backupData.budgets))
    );
  }
  if (backupData.goals) await writeCollection(GOALS_KEY, stamp(backupData.goals));

  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
};

/** Escapa aspas duplas para não quebrar a coluna no CSV. */
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const exportToCSV = async () => {
  const [transactions, bills, accounts, goals, budgets] = await Promise.all([
    getTransactions(),
    getBills(),
    getAccounts(),
    getGoals(),
    getBudgets(),
  ]);

  const accountNames = accounts.reduce(
    (map, account) => ({ ...map, [account.id]: account.name }),
    {}
  );

  let csvTransactions = 'Tipo,Descrição,Valor,Categoria,Carteira,Data\n';
  transactions.forEach(t => {
    csvTransactions += [
      t.type === 'income' ? 'Receita' : 'Despesa',
      csvCell(t.description),
      t.amount,
      csvCell(t.category),
      csvCell(accountNames[t.accountId] || ''),
      t.date,
    ].join(',') + '\n';
  });

  let csvBills = 'Descrição,Valor,Dia Vencimento,Categoria,Tipo,Meses Pagos\n';
  bills.forEach(b => {
    csvBills += [
      csvCell(b.description),
      b.amount,
      b.dueDay,
      csvCell(b.category),
      b.billType || 'fixa',
      csvCell((b.paidMonths || []).join(' ')),
    ].join(',') + '\n';
  });

  let csvGoals = 'Meta,Objetivo,Guardado,Prazo\n';
  goals.forEach(g => {
    csvGoals += [
      csvCell(g.name),
      g.targetAmount,
      g.savedAmount || 0,
      g.deadline ? formatDateBR(g.deadline) : '',
    ].join(',') + '\n';
  });

  let csvBudgets = 'Categoria,Limite Mensal\n';
  Object.entries(budgets).forEach(([category, limit]) => {
    csvBudgets += [csvCell(category), limit].join(',') + '\n';
  });

  return { csvTransactions, csvBills, csvGoals, csvBudgets };
};

// ---------------------------------------------------------------------------
// Resumo (usado no resumo semanal e na home)
// ---------------------------------------------------------------------------

/** Números do período para alimentar o resumo semanal. */
export const getPeriodSummary = async (start, end) => {
  const transactions = await getTransactions();

  const scoped = transactions.filter(t => {
    const date = getTransactionDate(t);
    return date && date >= start && date <= end;
  });

  const income = scoped.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = scoped.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const today = new Date();
  const bills = await getBills();
  const upcoming = filterBillsByMonth(bills, today.getMonth(), today.getFullYear())
    .filter(bill => !isBillPaidForMonth(bill, today.getMonth(), today.getFullYear()));

  return {
    income,
    expense,
    balance: income - expense,
    count: scoped.length,
    pendingBills: upcoming.length,
    pendingBillsAmount: upcoming.reduce((sum, bill) => sum + bill.amount, 0),
  };
};

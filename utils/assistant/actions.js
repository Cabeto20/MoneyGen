import {
  addTransaction,
  markBillAsPaid,
  getBills,
  DEFAULT_ACCOUNT_ID,
} from '../../database/database';
import { isBillPaidForMonth } from '../billHelpers';
import { getMonthLabel } from '../dateHelpers';
import { parseValidAmount } from '../validateAmount';
import { ACTION_TYPES, isExpired } from './actionBuilders';
import { money } from './replies';

/**
 * Execução das ações confirmadas — a única porta de escrita do assistente.
 *
 * Nada aqui fala com o AsyncStorage: gravar por fora do `database.js` quebraria
 * de uma vez as três invariantes do schema v3 (carimbo de `updatedAt`, exclusão
 * lógica e leitura pelos getters crus).
 */

const executeTransaction = async (action) => {
  const amount = parseValidAmount(action.payload.amount);
  if (amount === null) {
    return { ok: false, text: 'O valor desse lançamento não é válido. Me diga o valor de novo.' };
  }

  const transaction = await addTransaction(
    action.payload.description,
    amount,
    action.payload.type,
    action.payload.category,
    {
      // O construtor deixa null porque não conhece o padrão do banco.
      accountId: action.payload.accountId || DEFAULT_ACCOUNT_ID,
      date: new Date(action.payload.dateISO),
    }
  );

  const verb = action.payload.type === 'income' ? 'Registrei a receita de' : 'Lancei';
  return {
    ok: true,
    text: `${verb} ${money(amount)} em ${action.payload.category}.`,
    data: { transactionId: transaction?.id },
  };
};

const executePayBill = async (action) => {
  const { billId, month, year } = action.payload;

  // markBillAsPaid faz `return` silencioso quando a conta não existe e quando
  // já está quitada. Sem checar antes, o chat responderia "quitei" sem ter
  // quitado nada.
  const bill = (await getBills()).find((item) => item.id === billId);
  if (!bill) {
    return { ok: false, text: 'Essa conta não existe mais — deve ter sido excluída.' };
  }

  if (isBillPaidForMonth(bill, month, year)) {
    return { ok: true, text: `${bill.description} já estava quitada em ${getMonthLabel(month, year)}.` };
  }

  await markBillAsPaid(billId, month, year);

  return {
    ok: true,
    text: `${bill.description} quitada em ${getMonthLabel(month, year)} — a despesa de ${money(bill.amount)} foi lançada junto.`,
    data: { billId, month, year },
  };
};

/** Executa a ação confirmada. Nenhum caminho aqui lança para a tela. */
export const executeAction = async (action, now = new Date()) => {
  if (!action) return { ok: false, text: 'Não há nada para confirmar.' };

  if (isExpired(action, now)) {
    return {
      ok: false,
      expired: true,
      text: 'Essa confirmação é de um tempo atrás e os dados podem ter mudado. Me peça de novo, por favor.',
    };
  }

  switch (action.type) {
    case ACTION_TYPES.addExpense:
    case ACTION_TYPES.addIncome:
      return executeTransaction(action);
    case ACTION_TYPES.payBill:
      return executePayBill(action);
    default:
      return { ok: false, text: 'Não sei executar esse tipo de ação.' };
  }
};

import { getMonthLabel, formatDateBR } from '../dateHelpers';
import { money } from './replies';

/**
 * Montagem das ações de escrita — parte pura, sem tocar no banco. Fica separada
 * de `actions.js` para o motor continuar rodando em Node puro: quem executa
 * importa `database.js`, quem descreve não precisa.
 *
 * A ação não tem id próprio: ela vive dentro de uma mensagem do chat, e é o id
 * da mensagem que a identifica na hora de travar execução repetida.
 */

// Uma confirmação velha foi calculada contra dados que já mudaram: a conta pode
// ter sido paga por outra tela, o mês pode ter virado, a transação de origem
// pode ter virado lápide.
const MAX_AGE_MS = 60 * 60 * 1000;

export const ACTION_TYPES = {
  addExpense: 'addExpense',
  addIncome: 'addIncome',
  payBill: 'payBill',
};

/**
 * Descrição do lançamento a partir do que sobrou da frase: "gastei 50 no
 * mercado" vira "Mercado". Sem nada aproveitável, cai no nome da categoria.
 */
const buildDescription = (entities) => {
  const cleaned = entities.residual
    .replace(/\b(?:gastei|gasto|paguei|comprei|torrei|recebi|ganhei|entrou|caiu|foi)\b/g, ' ')
    .replace(/\b(?:no|na|em|de|do|da|com|por|reais|r\$|um|uma)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length >= 3) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return entities.category.value;
};

export const buildTransactionAction = (entities, type, now = new Date()) => {
  const isIncome = type === ACTION_TYPES.addIncome;

  // A data vem do período só quando ele é um dia ("ontem"); qualquer outro
  // recorte não define um dia de lançamento, então vale hoje.
  const date = entities.period && entities.period.kind === 'day' ? entities.period.start : now;

  const payload = {
    description: buildDescription(entities),
    // Sempre positivo: o tipo vem do verbo, nunca do sinal — "gastei -50"
    // continua sendo uma despesa de 50.
    amount: Math.abs(entities.amount),
    type: isIncome ? 'income' : 'expense',
    category: entities.category.value,
    // null e não a carteira padrão: quem executa é que conhece o default.
    accountId: entities.account ? entities.account.id : null,
    accountName: entities.account ? entities.account.name : null,
    dateISO: date.toISOString(),
  };

  const summary = [money(payload.amount), payload.category, payload.description, formatDateBR(payload.dateISO)]
    .filter(Boolean)
    .join(' · ');

  return {
    type,
    title: isIncome ? 'Lançar receita' : 'Lançar despesa',
    summary,
    label: `${isIncome ? 'Registrar receita' : 'Registrar despesa'} de ${money(payload.amount)} em ${payload.category}`,
    payload,
    editable: ['amount', 'category', 'accountId', 'dateISO', 'description'],
    confidence: entities.category.confident ? 'alta' : 'media',
    createdAt: now.toISOString(),
  };
};

export const buildPayBillAction = (bill, month, year, now = new Date()) => ({
  type: ACTION_TYPES.payBill,
  title: 'Quitar conta',
  summary: `${bill.description} · ${money(bill.amount)} · ${getMonthLabel(month, year)}`,
  label: `Marcar ${bill.description} (${money(bill.amount)}) como paga em ${getMonthLabel(month, year)}`,
  payload: {
    billId: bill.id,
    month,
    year,
    billDescription: bill.description,
    billAmount: bill.amount,
  },
  editable: ['month', 'year'],
  confidence: 'alta',
  createdAt: now.toISOString(),
});

export const isExpired = (action, now = new Date()) =>
  !action?.createdAt || now.getTime() - new Date(action.createdAt).getTime() > MAX_AGE_MS;

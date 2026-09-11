import { isBillPaidForMonth } from '../../billHelpers';
import { getMonthLabel } from '../../dateHelpers';
import { ACTION_TYPES, buildTransactionAction, buildPayBillAction } from '../actionBuilders';
import { confirm, noData, textBlock } from '../result';
import { money } from '../replies';
import { SUGGESTIONS } from '../suggestions';

// Quando o valor citado destoa demais da conta cadastrada, não é quitação:
// "paguei 450 de luz" com uma conta de R$ 210 é uma despesa avulsa.
const AMOUNT_TOLERANCE = 0.2;

const amountMatchesBill = (entities) => {
  if (entities.amount === null) return true;
  const reference = entities.bill?.amount;
  if (!(reference > 0)) return false;
  return Math.abs(entities.amount - reference) / reference <= AMOUNT_TOLERANCE;
};

export const addExpense = {
  id: 'add_expense',
  priority: 4,
  patterns: [
    /\b(?:gastei|paguei|comprei|torrei|gastando)\b/,
    /\b(?:lanca|lancar|registra|registrar|anota|anotar) (?:uma )?(?:despesa|saida|gasto)\b/,
    /\bsaiu\b/,
  ],
  keywordGroups: [['gastei', 'paguei', 'comprei', 'torrei', 'lanca', 'lancar', 'registra', 'registrar', 'anota', 'anotar', 'saiu']],
  requiredGroups: [0],
  requires: ['amount'],
  optional: ['category', 'account', 'period'],
  run: async (entities, snapshot) => {
    const action = buildTransactionAction(entities, ACTION_TYPES.addExpense, snapshot.now);

    const wallet = action.payload.accountName ? ` na carteira ${action.payload.accountName}` : '';
    const text = `Quer que eu lance ${money(action.payload.amount)} em ${action.payload.category} (${action.payload.description})${wallet}?`;

    return confirm('add_expense', text, action, {
      suggestions: [SUGGESTIONS.monthExpense, SUGGESTIONS.budgets],
    });
  },
};

export const addIncome = {
  id: 'add_income',
  priority: 4,
  patterns: [
    /\b(?:recebi|ganhei|entrou|caiu|creditou)\b/,
    /\b(?:lanca|lancar|registra|registrar|anota|anotar) (?:uma )?(?:receita|entrada)\b/,
  ],
  keywordGroups: [['recebi', 'ganhei', 'entrou', 'caiu', 'creditou', 'receita', 'entrada']],
  requiredGroups: [0],
  requires: ['amount'],
  optional: ['category', 'account', 'period'],
  run: async (entities, snapshot) => {
    const action = buildTransactionAction(entities, ACTION_TYPES.addIncome, snapshot.now);

    const wallet = action.payload.accountName ? ` na carteira ${action.payload.accountName}` : '';
    const text = `Quer que eu registre a receita de ${money(action.payload.amount)} em ${action.payload.category} (${action.payload.description})${wallet}?`;

    return confirm('add_income', text, action, {
      suggestions: [SUGGESTIONS.balance, SUGGESTIONS.monthSummary],
    });
  },
};

export const payBill = {
  id: 'pay_bill',
  priority: 4,
  patterns: [
    /\b(?:paguei|quitei|quitar|ja paguei)\b/,
    /\bmarca(?:r)? como pag[ao]\b/,
    /\bda baixa\b/,
  ],
  keywordGroups: [['paguei', 'quitei', 'quitar', 'como pago', 'como paga', 'baixa']],
  requiredGroups: [0],
  requires: ['bill'],
  optional: ['period'],
  // Sem conta reconhecida, ou com valor que destoa dela, isto não é quitação —
  // o guard tira a intenção da disputa e `add_expense` assume.
  guard: (entities) => !!entities.bill && amountMatchesBill(entities),
  run: async (entities, snapshot) => {
    const bills = await snapshot.bills();
    const bill = bills.find((item) => item.id === entities.bill.id);

    if (!bill) return noData('pay_bill', 'Essa conta não existe mais.');

    // Competência: o mês citado manda; sem ele, o mês corrente. Quitar julho em
    // agosto precisa carimbar julho, senão a despesa cai no mês errado.
    const period = entities.period;
    const month = period && period.month !== null ? period.month : snapshot.now.getMonth();
    const year = period && period.year !== null ? period.year : snapshot.now.getFullYear();

    if (isBillPaidForMonth(bill, month, year)) {
      const text = `${bill.description} já está quitada em ${getMonthLabel(month, year)}.`;
      return noData('pay_bill', text, {
        blocks: [textBlock(text)],
        suggestions: [SUGGESTIONS.billsDue, SUGGESTIONS.billsPending],
      });
    }

    const action = buildPayBillAction(bill, month, year, snapshot.now);
    const text = `Marcar ${bill.description} (${money(bill.amount)}) como paga em ${getMonthLabel(month, year)}? Isso também lança a despesa correspondente.`;

    return confirm('pay_bill', text, action, {
      suggestions: [SUGGESTIONS.billsDue, SUGGESTIONS.billsPending],
    });
  },
};

export default [payBill, addIncome, addExpense];

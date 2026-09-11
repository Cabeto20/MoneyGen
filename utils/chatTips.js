import { formatCurrency } from './formatCurrency';
import {
  filterBillsByMonth,
  isBillPaidForMonth,
  getBillDueDateFor,
} from './billHelpers';
import { daysUntil } from './dateHelpers';

/**
 * Dica do momento. Função pura: recebe o que a Home já tem em estado, para o
 * card não disparar nenhuma leitura extra do AsyncStorage.
 *
 * As regras são determinísticas e a primeira que casar vence — nada de sorteio.
 * Uma "dica do dia" que mudasse a cada renderização faria o usuário duvidar dos
 * números em vez de agir sobre eles.
 */

const DUE_SOON_DAYS = 3;

const FALLBACK = {
  id: 'fallback',
  text: 'Pergunte qualquer coisa sobre suas contas — eu calculo aqui mesmo.',
  question: 'o que você sabe fazer?',
};

export const pickTip = ({ balance, bills = [], budgets = [], goals = [] } = {}, now = new Date()) => {
  const month = now.getMonth();
  const year = now.getFullYear();

  // 1. Orçamento estourado é o que mais pede ação imediata.
  const exceeded = budgets.find((item) => item.status === 'exceeded');
  if (exceeded) {
    return {
      id: 'budget',
      text: `Você passou do limite em ${exceeded.category}.`,
      question: `quanto gastei com ${exceeded.category}?`,
    };
  }

  // 2. Conta vencendo (ou vencida).
  const open = filterBillsByMonth(bills, month, year)
    .filter((bill) => !isBillPaidForMonth(bill, month, year))
    .map((bill) => ({ bill, days: daysUntil(getBillDueDateFor(bill, month, year)) }))
    .filter((item) => item.days <= DUE_SOON_DAYS)
    .sort((a, b) => a.days - b.days);

  if (open.length > 0) {
    const { bill, days } = open[0];
    const when = days < 0 ? 'está vencida' : days === 0 ? 'vence hoje' : `vence em ${days} dia${days === 1 ? '' : 's'}`;
    return {
      id: 'bill',
      text: `${bill.description} ${when}.`,
      question: 'o que vence essa semana?',
    };
  }

  // 3. Saldo negativo.
  if (balance && balance.balance < 0) {
    return {
      id: 'balance',
      text: `Seu saldo está negativo em ${formatCurrency(Math.abs(balance.balance))}.`,
      question: 'com o que eu mais gasto?',
    };
  }

  // 4. Meta perto do alvo — a única regra em tom positivo.
  const closest = goals
    .filter((goal) => goal.savedAmount < goal.targetAmount && goal.targetAmount > 0)
    .sort((a, b) => b.savedAmount / b.targetAmount - a.savedAmount / a.targetAmount)[0];

  if (closest) {
    const missing = closest.targetAmount - closest.savedAmount;
    return {
      id: 'goal',
      text: `Faltam ${formatCurrency(missing)} para a meta ${closest.name}.`,
      question: `quanto falta pra meta ${closest.name}?`,
    };
  }

  return FALLBACK;
};

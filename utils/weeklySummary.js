import { getPeriodSummary } from '../database/database';
import { scheduleWeeklySummary, cancelWeeklySummary, getWeeklySummaryEnabled } from './notifications';
import { startOfWeek, endOfWeek } from './dateHelpers';
import { formatCurrency } from './formatCurrency';

/**
 * Ponte entre banco e notificações — mora aqui para não criar ciclo de import
 * (`database` já importa `notifications`).
 */
export const buildWeeklySummaryText = (summary) => {
  const parts = [
    `Receitas ${formatCurrency(summary.income)}`,
    `Despesas ${formatCurrency(summary.expense)}`,
    `Saldo ${formatCurrency(summary.balance)}`,
  ];

  if (summary.pendingBills > 0) {
    const plural = summary.pendingBills > 1 ? 'contas em aberto' : 'conta em aberto';
    parts.push(`${summary.pendingBills} ${plural} (${formatCurrency(summary.pendingBillsAmount)})`);
  }

  return parts.join(' · ');
};

/**
 * Recalcula os números da semana corrente e reagenda o lembrete recorrente.
 * Como o conteúdo agendado é estático, chamamos isto a cada abertura do app
 * para que o texto reflita os dados mais recentes.
 */
export const refreshWeeklySummary = async () => {
  try {
    if (!(await getWeeklySummaryEnabled())) {
      await cancelWeeklySummary();
      return;
    }

    const summary = await getPeriodSummary(startOfWeek(), endOfWeek());
    await scheduleWeeklySummary(buildWeeklySummaryText(summary));
  } catch (error) {
    console.error('Erro ao atualizar resumo semanal:', error);
  }
};

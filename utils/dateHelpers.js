/**
 * Chave canônica de mês usada para marcar competências (pagamentos, orçamentos).
 * Formato: 'YYYY-MM' com mês 1-based.
 */
export const monthKey = (month, year) => `${year}-${String(month + 1).padStart(2, '0')}`;

export const parseMonthKey = (key) => {
  const [year, month] = String(key).split('-');
  return { month: parseInt(month, 10) - 1, year: parseInt(year, 10) };
};

export const currentMonthKey = () => {
  const today = new Date();
  return monthKey(today.getMonth(), today.getFullYear());
};

export const formatDateBR = (date) => new Date(date).toLocaleDateString('pt-BR');

/** Converte 'dd/mm/yyyy' em Date. Retorna null se o formato não bater. */
export const parseDateBR = (text) => {
  if (typeof text !== 'string') return null;
  const parts = text.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Data de uma transação. Prefere `dateISO` (canônico, adicionado na v2) e cai
 * para o texto 'dd/mm/yyyy' das transações antigas.
 */
export const getTransactionDate = (transaction) => {
  if (transaction?.dateISO) {
    const parsed = new Date(transaction.dateISO);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return parseDateBR(transaction?.date);
};

export const isSameMonth = (date, month, year) =>
  !!date && date.getMonth() === month && date.getFullYear() === year;

export const addMonths = (month, year, delta) => {
  const total = year * 12 + month + delta;
  return { month: ((total % 12) + 12) % 12, year: Math.floor(total / 12) };
};

export const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

/**
 * Avança uma data em N meses preservando o dia. O dia é limitado ao último do
 * mês de destino — sem isso, 31/01 + 1 mês viraria 02/03 (o Date estoura).
 */
export const addMonthsToDate = (date, delta) => {
  const source = new Date(date);
  const { month, year } = addMonths(source.getMonth(), source.getFullYear(), delta);
  const day = Math.min(source.getDate(), daysInMonth(month, year));

  const result = new Date(year, month, day);
  result.setHours(
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds()
  );
  return result;
};

export const getMonthLabel = (month, year) =>
  new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export const getShortMonthLabel = (month, year) =>
  new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

/** Domingo 00:00 da semana em que `reference` cai. */
export const startOfWeek = (reference = new Date()) => {
  const start = new Date(reference);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
};

export const endOfWeek = (reference = new Date()) => {
  const end = startOfWeek(reference);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

/** Dias restantes até `date` (negativo se já passou). */
export const daysUntil = (date) => {
  const target = new Date(date);
  target.setHours(23, 59, 59, 999);
  return Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
};

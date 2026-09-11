import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  getMonthLabel,
} from '../../dateHelpers';

// Nomes já sem acento porque a extração roda sobre o texto normalizado.
const MONTH_NAMES = [
  ['janeiro', 'jan'],
  ['fevereiro', 'fev'],
  ['marco', 'mar'],
  ['abril', 'abr'],
  ['maio', 'mai'],
  ['junho', 'jun'],
  ['julho', 'jul'],
  ['agosto', 'ago'],
  ['setembro', 'set'],
  ['outubro', 'out'],
  ['novembro', 'nov'],
  ['dezembro', 'dez'],
];

const NUMBER_WORDS = {
  um: 1, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
};

/** Período de um mês fechado. */
export const buildMonthPeriod = (month, year, extra = {}) => ({
  kind: 'month',
  start: startOfMonth(month, year),
  end: endOfMonth(month, year),
  month,
  year,
  months: null,
  label: getMonthLabel(month, year),
  assumed: false,
  ...extra,
});

const buildDayPeriod = (date, label) => ({
  kind: 'day',
  start: startOfDay(date),
  end: endOfDay(date),
  month: date.getMonth(),
  year: date.getFullYear(),
  months: null,
  label,
  assumed: false,
});

const buildWeekPeriod = (reference, label) => ({
  kind: 'week',
  start: startOfWeek(reference),
  end: endOfWeek(reference),
  month: null,
  year: null,
  months: null,
  label,
  assumed: false,
});

const buildLastMonthsPeriod = (count, now) => {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(addMonths(now.getMonth(), now.getFullYear(), -i));
  }
  const first = months[0];
  const last = months[months.length - 1];
  return {
    kind: 'lastMonths',
    start: startOfMonth(first.month, first.year),
    end: endOfMonth(last.month, last.year),
    month: null,
    year: null,
    months,
    label: `nos ultimos ${count} meses`,
    assumed: false,
  };
};

const buildYearPeriod = (year) => ({
  kind: 'range',
  start: new Date(year, 0, 1, 0, 0, 0, 0),
  end: new Date(year, 11, 31, 23, 59, 59, 999),
  month: null,
  year,
  months: null,
  label: String(year),
  assumed: false,
});

/** Período assumido quando o usuário não falou de tempo: o mês corrente. */
export const defaultPeriod = (now = new Date()) =>
  buildMonthPeriod(now.getMonth(), now.getFullYear(), { assumed: true });

/**
 * Um mês nomeado que ainda não começou neste ano quase sempre se refere ao ano
 * passado — pergunta sobre dinheiro olha para trás. O ano alternativo segue
 * junto para a resposta poder oferecer "quis dizer dezembro de 2026?".
 */
const resolveNamedMonth = (month, now) => {
  const year = now.getFullYear();
  const started = month <= now.getMonth();
  return {
    month,
    year: started ? year : year - 1,
    alternateYear: started ? year - 1 : year,
  };
};

// Mais específico primeiro: "mes passado" tem que vencer "mes".
const MATCHERS = [
  {
    pattern: /\b(?:mes passado|ultimo mes|mes anterior)\b/,
    build: (match, now) => {
      const { month, year } = addMonths(now.getMonth(), now.getFullYear(), -1);
      return buildMonthPeriod(month, year);
    },
  },
  {
    pattern: /\b(?:(?:esse|este|neste|deste|desse|no|do) mes|mes atual)\b/,
    build: (match, now) => buildMonthPeriod(now.getMonth(), now.getFullYear(), { assumed: false }),
  },
  {
    pattern: /\b(?:semana passada|ultima semana)\b/,
    build: (match, now) => {
      const reference = new Date(now);
      reference.setDate(reference.getDate() - 7);
      return buildWeekPeriod(reference, 'semana passada');
    },
  },
  {
    pattern: /\b(?:(?:essa|esta|nesta|desta|dessa|na) semana|semana atual)\b/,
    build: (match, now) => buildWeekPeriod(now, 'essa semana'),
  },
  {
    pattern: /\banteontem\b/,
    build: (match, now) => {
      const date = new Date(now);
      date.setDate(date.getDate() - 2);
      return buildDayPeriod(date, 'anteontem');
    },
  },
  {
    pattern: /\bontem\b/,
    build: (match, now) => {
      const date = new Date(now);
      date.setDate(date.getDate() - 1);
      return buildDayPeriod(date, 'ontem');
    },
  },
  {
    pattern: /\bhoje\b/,
    build: (match, now) => buildDayPeriod(new Date(now), 'hoje'),
  },
  {
    pattern: /\bultim[oa]s? (\d{1,2}|um|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze) (?:meses|mes)\b/,
    build: (match, now) => {
      const raw = match[1];
      const count = NUMBER_WORDS[raw] || parseInt(raw, 10);
      // Faixa válida validada pelo intervalo: parseInt devolve NaN e toda
      // comparação com NaN é false, então testar o inválido deixaria passar.
      const safe = count >= 1 && count <= 24 ? count : 6;
      return buildLastMonthsPeriod(safe, now);
    },
  },
  {
    pattern: /\b(?:ano passado|ultimo ano)\b/,
    build: (match, now) => buildYearPeriod(now.getFullYear() - 1),
  },
  {
    pattern: /\b(?:(?:esse|este|neste|deste|desse) ano|ano atual)\b/,
    build: (match, now) => buildYearPeriod(now.getFullYear()),
  },
];

// Aceita "em julho", "de julho/2025", "julho de 2025" e "julho" solto.
const NAMED_MONTH = new RegExp(
  `\\b(?:em |de |no mes de )?(${MONTH_NAMES.map(([full, short]) => `${full}|${short}`).join('|')})\\b(?:[ /]?(?:de )?(\\d{4}|\\d{2}))?`
);

const matchNamedMonth = (text, now) => {
  const match = text.match(NAMED_MONTH);
  if (!match) return null;

  const name = match[1];
  const month = MONTH_NAMES.findIndex(([full, short]) => full === name || short === name);
  if (month === -1) return null;

  const rawYear = match[2];
  if (rawYear) {
    const parsed = parseInt(rawYear, 10);
    const year = rawYear.length === 2 ? 2000 + parsed : parsed;
    // Ano fora da faixa plausível é ruído (número de parcela, valor solto).
    if (year >= 2000 && year <= 2100) {
      return { period: buildMonthPeriod(month, year), match };
    }
  }

  const resolved = resolveNamedMonth(month, now);
  return {
    period: buildMonthPeriod(resolved.month, resolved.year, {
      alternateYear: resolved.alternateYear,
    }),
    match,
  };
};

/**
 * Encontra a expressão de tempo na frase e devolve o período mais o trecho que
 * ela ocupou — o resíduo precisa sair sem o ruído temporal para a classificação
 * não confundir "esse mês" com a intenção.
 */
export const extractPeriod = (normalizedText, now = new Date()) => {
  for (let i = 0; i < MATCHERS.length; i += 1) {
    const match = normalizedText.match(MATCHERS[i].pattern);
    if (match) {
      return {
        period: MATCHERS[i].build(match, now),
        span: { index: match.index, length: match[0].length },
      };
    }
  }

  const named = matchNamedMonth(normalizedText, now);
  if (named) {
    return {
      period: named.period,
      span: { index: named.match.index, length: named.match[0].length },
    };
  }

  return null;
};

/** Rótulo pronto para entrar numa frase: "em setembro de 2026", "hoje". */
export const periodPhrase = (period) => {
  if (!period) return '';
  if (period.assumed) return 'esse mês';
  if (period.kind === 'day' || period.kind === 'week' || period.kind === 'lastMonths') {
    return period.label;
  }
  return `em ${period.label}`;
};

export const isFuturePeriod = (period, now = new Date()) => !!period && period.start > now;

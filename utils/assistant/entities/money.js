import { parseAmount } from '../../txtImport';

// "mil" e "2 mil" são comuns na fala e não passam pelo parseAmount.
const THOUSAND = /\b(\d{1,3})?\s*mil\b/;

// Um valor no meio da frase: aceita "r$ 50", "1.234,56", "50,00", "2000".
const AMOUNT_TOKEN = /(?:r\$\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|(?:r\$\s*)?\d+(?:,\d{1,2})?/;

// Contextos em que um número não é dinheiro.
const NOT_MONEY = [
  /\bdia \d{1,2}\b/,
  /\b\d{1,2}h\b/,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
  /\b\d{1,2} (?:dias?|meses|mes|anos?|semanas?)\b/,
];

const stripNotMoney = (text) => {
  let masked = text;
  NOT_MONEY.forEach((pattern) => {
    masked = masked.replace(new RegExp(pattern.source, 'g'), (chunk) => ' '.repeat(chunk.length));
  });
  return masked;
};

/**
 * Valor monetário na frase. Devolve sempre positivo: o tipo do lançamento vem
 * do verbo ("gastei"/"recebi"), nunca do sinal — "gastei -50" é despesa de 50.
 */
export const extractAmount = (normalizedText) => {
  const masked = stripNotMoney(normalizedText);

  const thousand = masked.match(THOUSAND);
  if (thousand) {
    const multiplier = thousand[1] ? parseInt(thousand[1], 10) : 1;
    if (multiplier >= 1 && multiplier <= 999) {
      return {
        value: multiplier * 1000,
        raw: thousand[0].trim(),
        span: { index: thousand.index, length: thousand[0].length },
      };
    }
  }

  const match = masked.match(AMOUNT_TOKEN);
  if (!match) return null;

  const value = parseAmount(match[0]);
  if (value === null) return null;

  return {
    value: Math.abs(value),
    raw: match[0].trim(),
    span: { index: match.index, length: match[0].length },
  };
};

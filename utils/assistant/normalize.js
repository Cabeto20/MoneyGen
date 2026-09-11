/**
 * Normalização de texto em pt-BR para o assistente. Sem dependência externa:
 * é a base de toda comparação de texto do motor, então precisa rodar igual no
 * aparelho e no script de verificação em Node.
 */

// O Hermes só expõe String.prototype.normalize quando é compilado com ICU. Em
// vez de descobrir isso em produção num aparelho velho, há a tabela de fallback.
const ACCENT_MAP = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
};

export const stripAccents = (text) => {
  const value = String(text ?? '');
  if (typeof String.prototype.normalize === 'function') {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return value.replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (char) => ACCENT_MAP[char] || char);
};

/**
 * Forma canônica usada por toda comparação do assistente. Mantém `.`, `,`, `/`
 * e `-` porque valor e data dependem deles ("1.234,56", "12/07").
 */
export const normalizeText = (text) =>
  stripAccents(String(text ?? '').toLowerCase())
    .replace(/[^a-z0-9$\s.,:/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenize = (text) => normalizeText(text).split(' ').filter(Boolean);

const bigrams = (text) => {
  const pairs = [];
  for (let i = 0; i < text.length - 1; i += 1) pairs.push(text.slice(i, i + 2));
  return pairs;
};

/**
 * Coeficiente de Dice sobre bigramas: tolera erro de digitação e plural sem
 * precisar de biblioteca. Devolve 0..1.
 */
export const diceSimilarity = (a, b) => {
  const left = normalizeText(a).replace(/\s/g, '');
  const right = normalizeText(b).replace(/\s/g, '');
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  const pool = [...rightPairs];

  let hits = 0;
  leftPairs.forEach((pair) => {
    const index = pool.indexOf(pair);
    if (index !== -1) {
      hits += 1;
      pool.splice(index, 1); // consome o par para não contar duas vezes
    }
  });

  return (2 * hits) / (leftPairs.length + rightPairs.length);
};

/**
 * Melhor candidato por nome dentro de `items`. A inclusão literal ganha da
 * similaridade porque "luz" está contido em "conta de luz" e precisa vencer um
 * "cruz" com Dice alto.
 */
export const bestMatch = (query, items, getName, threshold = 0.55) => {
  const needle = normalizeText(query);
  if (!needle || !Array.isArray(items) || items.length === 0) return null;

  let best = null;

  items.forEach((item) => {
    const name = normalizeText(getName(item));
    if (!name) return;

    let score;
    if (name === needle) score = 1;
    else if (needle.includes(name) || name.includes(needle)) score = 0.9;
    else score = diceSimilarity(needle, name);

    if (!best || score > best.score) best = { item, score };
  });

  return best && best.score >= threshold ? best : null;
};

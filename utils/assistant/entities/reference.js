import { normalizeText, diceSimilarity } from '../normalize';
import { extractBillCategory } from './category';

// Palavras que não distinguem um registro de outro.
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'em', 'no', 'na',
  'com', 'para', 'pra', 'minha', 'meu', 'minhas', 'meus', 'conta', 'contas',
]);

const significantWords = (name) =>
  name.split(' ').filter((word) => word.length >= 3 && !STOPWORDS.has(word));

/**
 * Casa um registro pelo nome dentro da frase inteira. Não dá para usar o
 * bestMatch genérico aqui: ele compara a frase toda com o nome, e uma frase
 * longa contra um nome curto sempre pontua baixo.
 */
const matchByName = (normalizedText, items, getName) => {
  let best = null;

  items.forEach((item) => {
    const name = normalizeText(getName(item));
    if (!name) return;

    let score = 0;

    if (normalizedText.includes(name)) {
      score = 1;
    } else {
      const words = significantWords(name);
      if (words.length > 0) {
        const hits = words.filter((word) => normalizedText.includes(word)).length;
        score = (hits / words.length) * 0.9;
      }

      if (score < 0.6) {
        // Último recurso: erro de digitação numa palavra do nome.
        const textWords = normalizedText.split(' ').filter((word) => word.length >= 4);
        words.forEach((word) => {
          textWords.forEach((candidate) => {
            const similarity = diceSimilarity(candidate, word) * 0.8;
            if (similarity > score) score = similarity;
          });
        });
      }
    }

    if (score > 0 && (!best || score > best.score)) best = { item, score };
  });

  return best;
};

export const extractAccountRef = (normalizedText, accounts = [], threshold = 0.6) => {
  const match = matchByName(normalizedText, accounts, (account) => account.name);
  return match && match.score >= threshold ? match : null;
};

export const extractGoalRef = (normalizedText, goals = [], threshold = 0.6) => {
  const match = matchByName(normalizedText, goals, (goal) => goal.name);
  return match && match.score >= threshold ? match : null;
};

/**
 * Conta a pagar citada na frase. Além do nome, tenta a categoria: o usuário diz
 * "a conta de luz" e a conta pode estar cadastrada como "Enel" na categoria
 * Energia — o léxico de `txtImport` é quem faz essa ponte.
 */
export const extractBillRef = (normalizedText, bills = [], threshold = 0.6) => {
  const byName = matchByName(normalizedText, bills, (bill) => bill.description);
  if (byName && byName.score >= threshold) return byName;

  const category = extractBillCategory(normalizedText);
  if (category.confident) {
    const matches = bills.filter((bill) => bill.category === category.value);
    // Só vale se a categoria aponta para uma conta só; duas contas de Energia
    // deixariam a escolha no chute.
    if (matches.length === 1) return { item: matches[0], score: 0.8 };
  }

  return null;
};

// "conta de luz" fala de uma fatura; "na conta do Nubank" fala de carteira.
const BILL_HINT = /\b(?:conta d[eao]|fatura|boleto|parcela|prestacao)\b/;
const ACCOUNT_HINT = /\b(?:carteira|na conta|da conta|no cartao|saldo d[eao])\b/;

/** Qual sentido de "conta" a frase está usando, quando os dois casam. */
export const disambiguateAccountWord = (normalizedText) => {
  const bill = BILL_HINT.test(normalizedText);
  const account = ACCOUNT_HINT.test(normalizedText);
  if (bill && !account) return 'bill';
  if (account && !bill) return 'account';
  return null;
};

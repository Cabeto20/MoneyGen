import {
  ALL_EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  BILL_CATEGORIES,
} from '../../categories';
import { guessCategory, guessBillCategory } from '../../txtImport';
import { normalizeText, diceSimilarity } from '../normalize';

const namesOf = (list) => list.map((item) => item.name);

// "Energia", "Internet" e "Aluguel" só existem em BILL_CATEGORIES, mas viram
// despesa quando a conta é quitada. Sem elas, "quanto gastei com energia"
// devolveria zero com dados na tela.
const EXPENSE_NAMES = [...new Set([...namesOf(ALL_EXPENSE_CATEGORIES), ...namesOf(BILL_CATEGORIES)])];
const INCOME_NAMES = namesOf(INCOME_CATEGORIES);

const namesFor = (type) => (type === 'income' ? INCOME_NAMES : EXPENSE_NAMES);

const findLiteral = (normalizedText, names) => {
  let found = null;

  names.forEach((name) => {
    const needle = normalizeText(name);
    const index = normalizedText.indexOf(needle);
    if (index === -1) return;
    // O nome mais longo vence: "aluguel recebido" tem que ganhar de "aluguel".
    if (!found || needle.length > found.span.length) {
      found = { value: name, confident: true, span: { index, length: needle.length } };
    }
  });

  return found;
};

const findFuzzy = (normalizedText, names) => {
  const words = normalizedText.split(' ').filter((word) => word.length >= 4);
  let best = null;

  words.forEach((word) => {
    names.forEach((name) => {
      const score = diceSimilarity(word, name);
      if (score >= 0.7 && (!best || score > best.score)) {
        best = { value: name, score, word };
      }
    });
  });

  return best ? { value: best.value, confident: true, span: null } : null;
};

/**
 * Categoria citada na frase.
 *
 * `confident: false` significa que veio do palpite por palavra-chave sem
 * casamento real — serve para preencher um lançamento novo, mas não para
 * filtrar um relatório, senão "quanto gastei com xyz" responderia sobre
 * Serviços sem o usuário ter pedido.
 */
export const extractCategory = (normalizedText, type = 'expense') => {
  const names = namesFor(type);

  const literal = findLiteral(normalizedText, names);
  if (literal) return literal;

  // guessCategory sempre devolve um fallback; comparar com o palpite do texto
  // vazio é o que revela se alguma palavra-chave realmente casou.
  const guessed = guessCategory(normalizedText, type);
  const fallback = guessCategory('', type);
  if (guessed !== fallback) return { value: guessed, confident: true, span: null };

  const fuzzy = findFuzzy(normalizedText, names);
  if (fuzzy) return fuzzy;

  return { value: fallback, confident: false, span: null };
};

/** Categoria de conta a pagar, para quando o comando fala de uma fatura. */
export const extractBillCategory = (normalizedText) => {
  const literal = findLiteral(normalizedText, namesOf(BILL_CATEGORIES));
  if (literal) return literal;

  const guessed = guessBillCategory(normalizedText);
  const fallback = guessBillCategory('');
  if (guessed !== fallback) return { value: guessed, confident: true, span: null };

  return { value: fallback, confident: false, span: null };
};

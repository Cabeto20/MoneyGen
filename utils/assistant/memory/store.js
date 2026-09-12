import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeText, tokenize } from '../normalize';
import { WRITE_INTENTS } from '../semantic/corpus';

/**
 * O que o assistente aprendeu com este usuário.
 *
 * Fica numa chave própria, deliberadamente fora do schema v3 — mesma decisão do
 * `chatHistory`: não tem `updatedAt` de sincronização, não tem lápide e não
 * entra no backup. Aprendizado é modelo, não dado do usuário; fundir dois
 * aparelhos que aprenderam coisas diferentes só criaria conflito sem nada a
 * ganhar, e um backup restaurado ensinaria ao aparelho novo a gíria do antigo.
 *
 * Toda manipulação é função pura sobre o objeto do store; só `loadMemory` e
 * `saveMemory` tocam o AsyncStorage. É o que deixa a regra de poda testável sem
 * mock.
 */

const MEMORY_KEY = 'assistantMemory';
const VERSION = 1;

// Teto de frases guardadas. Não é limite de espaço — é limite de estrago: cada
// frase aprendida entra no índice semântico como se fosse corpus, e centenas de
// frases tortas de um usuário afogariam as paráfrases escritas à mão.
export const MAX_PHRASES = 120;

// Frase de uma palavra não ensina nada e atrapalha muito: "oi" ligado a
// `expense_period` responderia saldo para todo cumprimento.
const MIN_TOKENS = 2;

export const EMPTY_MEMORY = { version: VERSION, phrases: [], intentUses: {} };

/**
 * Uma frase só vira lição se der para confiar nela. A recusa é silenciosa de
 * propósito: quem chama está no meio de um turno de conversa e não tem o que
 * fazer com o erro.
 */
export const canLearn = (text, intentId) => {
  if (!intentId || WRITE_INTENTS.includes(intentId)) return false;
  const normalized = normalizeText(text);
  return tokenize(normalized).length >= MIN_TOKENS;
};

/**
 * Poda pela contagem, e só depois pela idade. O critério é esse porque uma
 * frase repetida é o jeito de falar do usuário; uma frase ensinada uma vez e
 * nunca mais usada foi provavelmente um toque errado no chip.
 */
const prune = (phrases) => {
  if (phrases.length <= MAX_PHRASES) return phrases;

  return [...phrases]
    .sort((a, b) => (b.count - a.count) || (b.updatedAt < a.updatedAt ? -1 : 1))
    .slice(0, MAX_PHRASES);
};

export const rememberPhrase = (memory, text, intentId, now = new Date()) => {
  if (!canLearn(text, intentId)) return memory;

  const normalized = normalizeText(text);
  const at = now.toISOString();
  const existing = memory.phrases.find((phrase) => phrase.text === normalized);

  // Mesma frase apontando para outra intenção sobrescreve em vez de somar: a
  // lição nova é a correção da antiga, não um empate a ser resolvido depois.
  const phrases = existing
    ? memory.phrases.map((phrase) =>
        phrase.text === normalized
          ? {
              ...phrase,
              intentId,
              count: phrase.intentId === intentId ? phrase.count + 1 : 1,
              updatedAt: at,
            }
          : phrase
      )
    : [...memory.phrases, { text: normalized, intentId, count: 1, updatedAt: at }];

  return { ...memory, phrases: prune(phrases) };
};

export const forgetPhrase = (memory, text) => {
  const normalized = normalizeText(text);
  return { ...memory, phrases: memory.phrases.filter((phrase) => phrase.text !== normalized) };
};

export const countIntentUse = (memory, intentId) => {
  if (!intentId) return memory;
  return {
    ...memory,
    intentUses: { ...memory.intentUses, [intentId]: (memory.intentUses[intentId] || 0) + 1 },
  };
};

/** Forma que o índice semântico consome, idêntica à do corpus escrito à mão. */
export const learnedEntries = (memory) =>
  memory.phrases.map((phrase) => ({ intentId: phrase.intentId, text: phrase.text }));

const sanitize = (raw) => {
  if (!raw || typeof raw !== 'object') return EMPTY_MEMORY;

  const phrases = Array.isArray(raw.phrases) ? raw.phrases : [];
  const uses = raw.intentUses && typeof raw.intentUses === 'object' ? raw.intentUses : {};

  return {
    version: VERSION,
    // Revalida na leitura, e não só na escrita: a lista de intenções de escrita
    // pode crescer depois de algo já ter sido gravado como aprendível.
    phrases: prune(
      phrases.filter(
        (phrase) =>
          phrase &&
          typeof phrase.text === 'string' &&
          canLearn(phrase.text, phrase.intentId) &&
          typeof phrase.count === 'number'
      )
    ),
    intentUses: Object.keys(uses).reduce((map, key) => {
      if (typeof uses[key] === 'number' && uses[key] > 0) map[key] = uses[key];
      return map;
    }, {}),
  };
};

export const loadMemory = async () => {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_KEY);
    return raw ? sanitize(JSON.parse(raw)) : EMPTY_MEMORY;
  } catch (error) {
    // Memória corrompida não pode derrubar o chat: sem ela o assistente volta a
    // ser o de antes do aprendizado, que ainda responde tudo.
    console.error('Erro ao ler a memória do assistente:', error);
    return EMPTY_MEMORY;
  }
};

export const saveMemory = async (memory) => {
  try {
    await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
    return true;
  } catch (error) {
    console.error('Erro ao gravar a memória do assistente:', error);
    return false;
  }
};

export const clearMemory = async () => {
  try {
    await AsyncStorage.removeItem(MEMORY_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao apagar a memória do assistente:', error);
    return false;
  }
};

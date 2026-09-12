import { setLearnedEntries } from '../semantic';
import { setIntentUsage } from '../suggestions';
import {
  EMPTY_MEMORY,
  loadMemory,
  saveMemory,
  clearMemory,
  rememberPhrase,
  forgetPhrase,
  countIntentUse,
  learnedEntries,
} from './store';

export { MAX_PHRASES, canLearn } from './store';
export { trainCategoryModel } from './categoryModel';

/**
 * Fachada da memória do assistente.
 *
 * O motor (`resolver`, `runner`, `semantic`, `suggestions`) não pode conhecer
 * AsyncStorage — ele roda no Node do `check-assistant` e no Jest, onde não
 * existe armazenamento. Por isso a direção é invertida: este módulo carrega o
 * que foi aprendido e **empurra** para dentro do motor (`setLearnedEntries`,
 * `setIntentUsage`), em vez de o motor vir buscar.
 *
 * O estado fica no módulo porque a memória vale para o app inteiro e não para
 * um turno — é o oposto do snapshot, que é descartado a cada pergunta.
 */

let memory = EMPTY_MEMORY;
let hydration = null;

/** Reflete a memória atual nos dois pontos do motor que a consomem. */
const push = () => {
  setLearnedEntries(learnedEntries(memory));
  setIntentUsage(memory.intentUses);
};

/**
 * Carrega uma vez por processo. A promessa fica guardada para os vários
 * caminhos que chamam isto (abrir o chat, perguntar, ensinar) compartilharem a
 * mesma leitura em vez de disparar três.
 */
export const hydrateMemory = () => {
  if (!hydration) {
    hydration = loadMemory()
      .then((loaded) => {
        memory = loaded;
        push();
        return loaded;
      })
      .catch((error) => {
        // Falhar aqui não pode travar o chat: sem memória o assistente volta a
        // ser o de antes do aprendizado, que ainda responde tudo.
        console.error('Erro ao hidratar a memória do assistente:', error);
        hydration = null;
        return EMPTY_MEMORY;
      });
  }
  return hydration;
};

const commit = async (next) => {
  // Comparar por identidade basta: as funções do store são puras e devolvem o
  // mesmo objeto quando a operação foi recusada (frase curta, intenção de
  // escrita). Sem isso, um toque recusado gravaria o arquivo à toa.
  if (next === memory) return false;
  memory = next;
  push();
  await saveMemory(memory);
  return true;
};

/**
 * Ensina que `text` significa `intentId`.
 *
 * O ponto que chama é o único lugar onde isso é seguro: o usuário tocou num
 * chip do cardápio que apareceu logo depois de um "não sei responder isso". O
 * toque é a correção — não há adivinhação envolvida.
 */
export const learnPhrase = async (text, intentId) => {
  await hydrateMemory();
  return commit(rememberPhrase(memory, text, intentId));
};

export const unlearnPhrase = async (text) => {
  await hydrateMemory();
  return commit(forgetPhrase(memory, text));
};

/** Conta que a intenção foi acionada, para o cardápio se reordenar. */
export const recordIntentUse = async (intentId) => {
  await hydrateMemory();
  return commit(countIntentUse(memory, intentId));
};

/** O que foi aprendido até agora. Leitura — para tela de ajustes e para teste. */
export const getMemory = () => memory;

/** Esquece tudo. É o botão de "voltar ao assistente de fábrica". */
export const forgetEverything = async () => {
  await clearMemory();
  memory = EMPTY_MEMORY;
  hydration = Promise.resolve(EMPTY_MEMORY);
  push();
  return true;
};

/** Descarta o estado em memória. Só interessa a teste. */
export const resetMemoryCache = () => {
  memory = EMPTY_MEMORY;
  hydration = null;
  push();
};

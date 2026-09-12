import { cosine, getEmbedderFactory } from './embedder';
import { CORPUS_ENTRIES, WRITE_INTENTS, OUT_OF_SCOPE_INTENT } from './corpus';

export { setEmbedderFactory, createLexicalEmbedder } from './embedder';
export { CORPUS, CORPUS_ENTRIES, WRITE_INTENTS, OUT_OF_SCOPE_INTENT } from './corpus';

/**
 * Índice de paráfrases: acha a intenção por proximidade de sentido quando
 * nenhum padrão nem palavra-chave casou.
 *
 * Os três freios abaixo existem porque o custo do erro é assimétrico. Deixar
 * uma frase cair no fallback mostra o cardápio de capacidades, que é uma
 * resposta ruim mas honesta; responder a intenção errada com número de verdade
 * na tela é o usuário tomando decisão de dinheiro em cima de mentira.
 */

// Cosseno mínimo contra a paráfrase mais próxima. Fica no meio do vão medido
// pelas fixtures: a pior frase legítima tira 0,375 e a melhor frase de outro
// assunto que escapa da turma `out_of_scope` tira 0,263.
export const MIN_SIMILARITY = 0.32;
// Fração das palavras da frase que o corpus precisa conhecer. Segura frase de
// outro assunto que por acaso compartilha o esqueleto ("qual a capital ...").
export const MIN_COVERAGE = 0.4;
// Distância relativa para a segunda intenção. Relativa, e não absoluta,
// porque cosseno de frase curta é baixo em bloco: 0,50 contra 0,44 é a mesma
// dúvida que 0,90 contra 0,79, e um corte fixo só reprovaria a frase curta.
// Empate aqui não vira pergunta de desambiguação: sem certeza, o fallback é
// mais barato que chutar.
export const MIN_MARGIN = 0.06;

let indexPromise = null;
let learned = [];

/**
 * Frases que o usuário ensinou (camada 1), na mesma forma do corpus escrito à
 * mão. Entram aqui em vez de num caminho próprio de busca porque uma frase
 * aprendida tem que generalizar igual às outras: ensinar "tô liso" uma vez
 * precisa valer para "tô lisinho" depois, e é o índice que faz isso.
 *
 * Recebe o array pronto, e não uma função de carga, para este módulo não
 * conhecer AsyncStorage — ele roda no Node do `check-assistant` e no Jest, onde
 * não existe armazenamento nenhum. Quem carrega é `memory/`.
 */
export const setLearnedEntries = (entries) => {
  learned = (Array.isArray(entries) ? entries : []).filter(
    (entry) => entry && typeof entry.text === 'string' && entry.text.trim() && entry.intentId
  );
  resetSemanticIndex();
};

const buildIndex = async () => {
  const entries = [...CORPUS_ENTRIES, ...learned];
  const embedder = await getEmbedderFactory()(entries.map((entry) => entry.text));

  const vectors = [];
  for (const entry of entries) {
    // Sequencial de propósito: um embedder de modelo local não ganha nada com
    // paralelismo em JS e ainda arrisca estourar memória carregando tudo junto.
    vectors.push(await embedder.embed(entry.text));
  }

  return { embedder, entries, vectors };
};

const getIndex = () => {
  if (!indexPromise) {
    // A promessa fica no módulo para o índice ser montado uma vez só por
    // processo, e não a cada turno do chat.
    indexPromise = buildIndex().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
};

/** Descarta o índice. Só interessa a teste e à troca de embedder em runtime. */
export const resetSemanticIndex = () => {
  indexPromise = null;
};

/** Monta o índice fora do turno, para o primeiro "não entendi" não pagar a conta. */
export const warmSemanticIndex = () => getIndex().then(() => true).catch(() => false);

/**
 * Melhor intenção para a frase, ou `null` quando nenhum freio foi vencido.
 * `allowed` restringe às intenções que o resolvedor aceita naquele turno.
 */
export const semanticMatch = async (text, allowed = null) => {
  if (!text || !String(text).trim()) return null;

  const { embedder, entries, vectors } = await getIndex();

  const coverage = typeof embedder.coverage === 'function' ? embedder.coverage(text) : 1;
  if (coverage < MIN_COVERAGE) return null;

  const query = await embedder.embed(text);

  // Melhor paráfrase de cada intenção. Uma intenção com 8 exemplos não pode
  // ganhar de outra com 3 só por ter mais chances de encostar.
  const best = new Map();
  entries.forEach((entry, index) => {
    if (WRITE_INTENTS.includes(entry.intentId)) return;
    // A turma de fora de alcance concorre normalmente — o filtro de `allowed`
    // não pode excluí-la, senão ela perde a função de absorver o ruído.
    const restricted = allowed && !allowed.includes(entry.intentId);
    if (restricted && entry.intentId !== OUT_OF_SCOPE_INTENT) return;

    const score = cosine(query, vectors[index]);
    const current = best.get(entry.intentId);
    if (!current || score > current.score) {
      best.set(entry.intentId, { intentId: entry.intentId, score, matched: entry.text });
    }
  });

  const ranked = [...best.values()].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < MIN_SIMILARITY) return null;
  // Venceu a conversa-fiada: a frase não é sobre dinheiro.
  if (top.intentId === OUT_OF_SCOPE_INTENT) return null;

  const runnerUp = ranked[1];
  if (runnerUp && (top.score - runnerUp.score) / top.score < MIN_MARGIN) return null;

  return { ...top, coverage };
};

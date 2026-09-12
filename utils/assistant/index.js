import { extractEntities } from './entities';
import { INTENTS, INTENT_BY_ID } from './intents';
import { resolveIntent } from './resolver';
import { runIntent } from './runner';
import { createSnapshot, loadRefs } from './snapshot';
import { executeAction } from './actions';
import { DEFAULT_SUGGESTIONS } from './suggestions';
import { buildInsights } from './intents/insights';
import { hydrateMemory, learnPhrase, recordIntentUse } from './memory';

export { executeAction } from './actions';
export { DEFAULT_SUGGESTIONS, CAPABILITY_GROUPS, SUGGESTIONS } from './suggestions';
export { isExpired } from './actionBuilders';
export { warmSemanticIndex, setEmbedderFactory } from './semantic';
export { hydrateMemory, getMemory, forgetEverything, unlearnPhrase } from './memory';

/**
 * Fachada do assistente. É o único ponto que a tela precisa conhecer.
 *
 * Cada turno cria o próprio snapshot e o descarta no fim: um cache que
 * sobrevivesse ao turno ficaria velho assim que o chat gravasse um lançamento.
 */

/**
 * Completa uma intenção que ficou esperando um dado. A memória vem de fora, no
 * `options.pending` — o motor em si não guarda estado entre turnos.
 */
const mergePending = (pending, entities) => ({
  ...pending.entities,
  text: entities.text,
  residual: pending.entities.residual,
  amount: entities.amount !== null ? entities.amount : pending.entities.amount,
  installments:
    entities.installments !== null ? entities.installments : pending.entities.installments,
  period: entities.period || pending.entities.period,
  periodOrDefault: entities.period || pending.entities.periodOrDefault,
  category: entities.category.confident ? entities.category : pending.entities.category,
  account: entities.account || pending.entities.account,
  goal: entities.goal || pending.entities.goal,
  bill: entities.bill || pending.entities.bill,
});

/**
 * O turno chegou a uma intenção de verdade.
 *
 * Fallback, erro e ambiguidade não contam: neles o assistente não entendeu, e
 * contá-los ensinaria o cardápio a promover justamente o que não funcionou.
 * `needs-entity` também fica de fora — a intenção ainda pode ser abandonada na
 * pergunta seguinte.
 */
const RESOLVED_STATUSES = ['ok', 'no-data', 'pending-action'];
const isResolved = (result) => !!result && RESOLVED_STATUSES.includes(result.status);

/**
 * Registra o que este turno ensinou.
 *
 * `teachFor` é a frase que o assistente não entendeu no turno anterior, e só
 * chega aqui quando o usuário tocou num chip do cardápio que aquele próprio
 * "não sei responder" mostrou. É correção explícita: a frase de lá significa
 * a intenção que este turno acabou de rodar.
 *
 * Nada disso pode derrubar nem atrasar a resposta: gravar memória é
 * escrituração do turno, não parte dele. Por isso quem chama não espera o
 * resultado e o erro morre aqui dentro.
 */
const absorb = async (result, options) => {
  if (!isResolved(result)) return;

  try {
    await recordIntentUse(result.intentId);
    if (options.teachFor) await learnPhrase(options.teachFor, result.intentId);
  } catch (error) {
    console.error('Erro ao gravar o aprendizado do assistente:', error);
  }
};

export const askAssistant = async (rawText, options = {}) => {
  const now = options.now || new Date();
  const snapshot = createSnapshot(now);

  try {
    // Antes de classificar: as frases já ensinadas precisam estar no índice
    // semântico neste turno, não no próximo. A chamada é barata depois da
    // primeira — a promessa fica guardada no módulo de memória.
    await hydrateMemory();

    const refs = await loadRefs(snapshot);
    const entities = extractEntities(rawText, refs, now);

    // Resposta a uma pergunta do próprio assistente ("Quanto foi?"): retoma a
    // intenção anterior em vez de classificar "50" do zero.
    const pending = options.pending;
    if (pending && INTENT_BY_ID[pending.intentId]) {
      const merged = mergePending(pending, entities);
      const intent = INTENT_BY_ID[pending.intentId];
      const stillMissing = (intent.requires || []).filter((name) => {
        if (name === 'category') return !merged.category?.confident;
        return merged[name] === null || merged[name] === undefined;
      });

      if (stillMissing.length === 0) {
        const completed = await runIntent({ status: 'ok', intent, entities: merged, present: [] }, snapshot);
        absorb(completed, options);
        return completed;
      }
    }

    const resolution = resolveIntent(entities, INTENTS);
    const result = await runIntent(resolution, snapshot);
    absorb(result, options);

    // __DEV__ so existe no bundler; guardar o typeof mantem o modulo
    // importavel de qualquer lugar.
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    return isDev ? { ...result, debug: resolution.debug } : result;
  } catch (error) {
    console.error('Erro no assistente:', error);
    const text =
      'Não consegui responder agora. Os números continuam nas telas de Relatórios e Contas.';
    return {
      intentId: 'error',
      status: 'error',
      text,
      blocks: [{ type: 'text', text }],
      data: null,
      suggestions: DEFAULT_SUGGESTIONS,
      action: null,
      missing: null,
      alternatives: null,
    };
  }
};

/** Executa uma ação confirmada e devolve o texto que vira a próxima bolha. */
export const runPendingAction = async (action) => {
  try {
    return await executeAction(action);
  } catch (error) {
    console.error('Erro ao executar ação do assistente:', error);
    return {
      ok: false,
      text: 'Não consegui gravar. Tente pela tela de lançamentos.',
    };
  }
};

/** Dicas do momento, para a abertura do chat. */
export const getInsights = async (now = new Date()) => {
  try {
    return await buildInsights(createSnapshot(now));
  } catch (error) {
    console.error('Erro ao montar dicas do assistente:', error);
    return [];
  }
};

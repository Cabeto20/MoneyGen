import { resolveIntent } from './resolver';
import { buildFallback } from './intents/help';
import { ERROR_TEXT } from './replies';
import { DEFAULT_SUGGESTIONS, SUGGESTIONS } from './suggestions';

/** Pergunta que o assistente faz quando falta uma entidade obrigatória. */
const ENTITY_QUESTIONS = {
  amount: 'Quanto foi?',
  category: 'Em qual categoria?',
  account: 'De qual carteira?',
  goal: 'Qual meta?',
  bill: 'Qual conta?',
  installments: 'Em quantas parcelas?',
};

const errorResult = (intentId, error) => {
  // O erro em si não vai para a bolha: o usuário não tem o que fazer com um
  // stack trace, e o console guarda o suficiente para depurar.
  console.error('Erro no assistente:', error);
  return {
    intentId,
    status: 'error',
    text: ERROR_TEXT,
    blocks: [{ type: 'text', text: ERROR_TEXT }],
    data: null,
    suggestions: DEFAULT_SUGGESTIONS,
    action: null,
    missing: null,
    alternatives: null,
  };
};

/**
 * Roda a intenção escolhida e garante que o resultado sempre tem texto e
 * sugestões — nenhum caminho, nem o de erro, devolve bolha vazia.
 */
export const runIntent = async (resolution, snapshot) => {
  const { status, intent, entities, present } = resolution;

  if (status === 'fallback' || !intent) {
    return buildFallback(present);
  }

  if (status === 'ambiguous') {
    const options = resolution.alternatives.map((option) => ({
      id: option.id,
      label: option.ambiguityLabel || option.id,
      sends: option.ambiguitySends || option.id,
    }));
    const text = 'Não sei se você quis dizer uma coisa ou outra. Qual delas?';

    return {
      intentId: 'ambiguous',
      status: 'ambiguous',
      text,
      blocks: [{ type: 'text', text }, { type: 'actions', options }],
      data: null,
      suggestions: [],
      action: null,
      missing: null,
      alternatives: resolution.alternatives.map((option) => option.id),
    };
  }

  if (status === 'needs-entity') {
    const missing = resolution.missing;
    const question = ENTITY_QUESTIONS[missing[0]] || 'Faltou um dado para eu calcular.';

    return {
      intentId: intent.id,
      status: 'needs-entity',
      text: question,
      blocks: [{ type: 'text', text: question }],
      data: null,
      suggestions: [SUGGESTIONS.help],
      action: null,
      missing,
      alternatives: null,
      // Guardado para a próxima mensagem poder completar a intenção sem o
      // usuário repetir a frase inteira.
      pending: { intentId: intent.id, entities },
    };
  }

  try {
    const result = await intent.run(entities, snapshot);
    if (!result || !result.text) return errorResult(intent.id, new Error('Resultado sem texto'));
    return result;
  } catch (error) {
    return errorResult(intent.id, error);
  }
};

/**
 * Turno completo sobre entidades já extraídas. Fica separado de `index.js`
 * para poder rodar em Node com um snapshot falso — `index.js` é quem amarra o
 * banco e por isso não roda fora do app.
 */
export const respond = async (entities, intents, snapshot) => {
  const resolution = resolveIntent(entities, intents);
  const result = await runIntent(resolution, snapshot);
  return { ...result, debug: resolution.debug };
};

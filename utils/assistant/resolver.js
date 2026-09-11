import { presentEntities } from './entities';

export const MIN_SCORE = 6;

// Uma segunda colocada muito perto da primeira significa que a frase não
// decidiu — perguntar é melhor que chutar.
const AMBIGUITY_MARGIN = 0.15;

const PATTERN_POINTS = 10;
const KEYWORD_POINTS = 3;
const OPTIONAL_ENTITY_POINTS = 2;
// Pesado de propósito: uma intenção que nem consegue rodar por falta de dado
// não pode vencer outra que tem tudo. "quanto ainda posso gastar com lazer"
// casa com "posso gastar" (sem valor) e com o orçamento de Lazer — é o
// orçamento que responde.
const MISSING_REQUIRED_PENALTY = 8;

const scoreIntent = (intent, entities, present) => {
  const fullText = entities.text;
  const residual = entities.residual;

  // Regra de negócio que nenhum placar expressa: "paguei 450 de luz" com uma
  // conta de R$ 210 não é quitação, é despesa avulsa. O guard elimina a
  // intenção antes da pontuação em vez de tentar compensar com peso.
  if (intent.guard && !intent.guard(entities)) return null;

  const matchedGroups = (intent.keywordGroups || []).map((group) =>
    group.some((keyword) => residual.includes(keyword))
  );

  // Grupo obrigatório que não casou elimina a intenção: sem o verbo, "posso
  // gastar" e "quanto gastei" viram a mesma coisa.
  const required = intent.requiredGroups || [];
  if (required.some((index) => !matchedGroups[index])) return null;

  let score = 0;
  let matchedLength = 0;

  (intent.patterns || []).forEach((pattern) => {
    const match = fullText.match(pattern);
    if (match) {
      score += PATTERN_POINTS;
      matchedLength += match[0].length;
    }
  });

  score += matchedGroups.filter(Boolean).length * KEYWORD_POINTS;

  const optional = intent.optional || [];
  const consumed = optional.filter((name) => present.includes(name));
  score += consumed.length * OPTIONAL_ENTITY_POINTS;

  const requires = intent.requires || [];
  const missing = requires.filter((name) => !present.includes(name));
  score -= missing.length * MISSING_REQUIRED_PENALTY;

  (intent.boosts || []).forEach((boost) => {
    if (boost.when(present)) score += boost.points;
  });

  return {
    intent,
    score,
    matchedLength,
    consumed: consumed.length + (requires.length - missing.length),
    missing,
  };
};

const compare = (a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  // Intenção que muda dado ganha de consulta: "paguei a conta de luz" casa com
  // as duas, e quem fala isso quer quitar, não consultar.
  if (b.intent.priority !== a.intent.priority) return b.intent.priority - a.intent.priority;
  if (b.consumed !== a.consumed) return b.consumed - a.consumed;
  if (b.matchedLength !== a.matchedLength) return b.matchedLength - a.matchedLength;
  return a.order - b.order;
};

/**
 * Escolhe a intenção. Os padrões rodam no texto completo (precisam enxergar
 * "esse mês") e as palavras-chave no resíduo, já sem valor nem período — é o
 * ruído numérico e temporal que embaralha a classificação em pt-BR.
 */
export const resolveIntent = (entities, intents) => {
  const present = presentEntities(entities);

  const scored = intents
    .map((intent, order) => {
      const result = scoreIntent(intent, entities, present);
      return result ? { ...result, order } : null;
    })
    .filter(Boolean)
    .sort(compare);

  const debug = scored.map((item) => ({ intentId: item.intent.id, score: item.score }));

  const best = scored[0];
  if (!best || best.score < MIN_SCORE) {
    return { status: 'fallback', intent: null, entities, present, debug };
  }

  const runnerUp = scored[1];
  // Empate técnico de verdade: além do placar, as duas precisam ter casado com
  // a mesma força. "como estou indo" empata em pontos com "como estou", mas o
  // padrão vencedor cobre mais da frase — isso é match melhor, não empate.
  const similarlySpecific =
    runnerUp && runnerUp.matchedLength >= best.matchedLength * 0.8;

  if (
    runnerUp &&
    runnerUp.score >= MIN_SCORE &&
    best.score > 0 &&
    (best.score - runnerUp.score) / best.score < AMBIGUITY_MARGIN &&
    runnerUp.intent.priority === best.intent.priority &&
    similarlySpecific
  ) {
    return {
      status: 'ambiguous',
      intent: best.intent,
      alternatives: [best.intent, runnerUp.intent],
      entities,
      present,
      debug,
    };
  }

  if (best.missing.length > 0) {
    return {
      status: 'needs-entity',
      intent: best.intent,
      missing: best.missing,
      entities,
      present,
      debug,
    };
  }

  return { status: 'ok', intent: best.intent, entities, present, debug };
};

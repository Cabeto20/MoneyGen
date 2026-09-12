import { ok } from '../result';
import { orderedCapabilityGroups, fallbackSuggestions } from '../suggestions';

// Ordenado por uso: o cardápio aparece no fallback e na ajuda, que é
// justamente onde o usuário está perdido — pôr na frente o que ele mais
// pergunta é o que torna o aprendizado visível para ele.
const capabilityBlocks = () =>
  orderedCapabilityGroups().map((group) => ({
    type: 'actions',
    title: group.title,
    options: group.items.map((item) => ({
      id: item.id,
      label: item.label,
      sends: item.text,
    })),
  }));

export const help = {
  id: 'help',
  priority: 1,
  patterns: [
    /\bo que (?:voce|vc) (?:faz|sabe|pode)\b/,
    /\b(?:me )?ajuda\b/,
    /\bcomandos?\b/,
    /\bmenu\b/,
    /\bcomo (?:voce|vc) funciona\b/,
    /\bo que (?:eu )?posso (?:te )?perguntar\b/,
  ],
  keywordGroups: [['ajuda', 'ajudar', 'o que voce', 'o que vc', 'comando', 'comandos', 'menu', 'funciona']],
  requiredGroups: [0],
  run: async () => {
    const text =
      'Eu respondo sobre o seu dinheiro usando só o que está guardado aqui no aparelho. Alguns exemplos:';

    return ok('help', text, {
      blocks: [{ type: 'text', text }, ...capabilityBlocks()],
      suggestions: [],
    });
  },
};

/**
 * Resposta de quando nada casou. Mostra o cardápio em vez de "não entendi":
 * num motor de regras, a falha é a única chance de ensinar o que existe.
 */
export const buildFallback = (present = []) => {
  const text =
    'Ainda não sei responder isso. Mas eu sei, por exemplo:';

  return {
    intentId: 'fallback',
    status: 'fallback',
    text,
    blocks: [{ type: 'text', text }, ...capabilityBlocks()],
    data: null,
    suggestions: fallbackSuggestions(present),
    action: null,
    missing: null,
    alternatives: null,
  };
};

export default [help];

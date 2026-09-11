import { DEFAULT_SUGGESTIONS } from './suggestions';

/**
 * Construtores do resultado de uma intenção.
 *
 * Invariante que todo caminho respeita: `text` nunca é vazio e `blocks` sempre
 * tem pelo menos o texto. A tela pode ignorar `data` e mostrar só a frase — ou
 * usar `data` para montar cartão e lista sem recalcular nada.
 */

const base = (intentId, status, text, options = {}) => ({
  intentId,
  status,
  text,
  blocks: options.blocks || [{ type: 'text', text }],
  data: options.data || null,
  suggestions: options.suggestions || DEFAULT_SUGGESTIONS,
  action: options.action || null,
  missing: options.missing || null,
  alternatives: options.alternatives || null,
});

export const ok = (intentId, text, options) => base(intentId, 'ok', text, options);

export const noData = (intentId, text, options) => base(intentId, 'no-data', text, options);

export const needsEntity = (intentId, text, missing, options = {}) =>
  base(intentId, 'needs-entity', text, { ...options, missing });

export const confirm = (intentId, text, action, options = {}) =>
  base(intentId, 'pending-action', text, {
    ...options,
    action,
    blocks: options.blocks || [
      { type: 'text', text },
      { type: 'confirmation', question: action.label },
    ],
  });

export const textBlock = (text) => ({ type: 'text', text });

export const valueBlock = (label, value, tone = 'neutro') => ({
  type: 'value',
  label,
  value,
  tone,
});

/** Lista dentro da bolha. Capa em 5 itens aqui, na montagem: uma lista de 30 */
/** contas viraria uma bolha de rolagem infinita e um JSON grande no histórico. */
export const listBlock = (items, options = {}) => ({
  type: 'list',
  items: items.slice(0, 5),
  total: items.length,
  ...options,
});

export const actionsBlock = (options) => ({ type: 'actions', options });

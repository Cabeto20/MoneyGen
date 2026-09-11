import { formatCurrency } from '../formatCurrency';

/**
 * Todo texto visível do assistente nasce aqui. Concentrar os moldes num lugar
 * só é o que impede a mesma informação de sair escrita de três jeitos
 * diferentes conforme a intenção que respondeu.
 */

export const money = (value) => formatCurrency(value || 0);

export const percent = (ratio) => `${Math.round(Math.abs(ratio || 0) * 100)}%`;

/** Plural simples: `count(3, 'conta', 'contas')` → "3 contas". */
export const count = (value, singular, plural) =>
  `${value} ${value === 1 ? singular : plural}`;

/** Junta pedaços descartando os vazios, para molde com parte opcional. */
export const join = (parts, separator = ' ') => parts.filter(Boolean).join(separator);

/** Lista em português: "a, b e c". */
export const listNames = (names) => {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
};

export const capitalize = (text) =>
  typeof text === 'string' && text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;

/** Frase de variação: "12% a mais", "8% a menos", "no mesmo patamar". */
export const changePhrase = (deltaPercent) => {
  if (deltaPercent === null || deltaPercent === undefined) return 'sem base de comparação';
  if (Math.abs(deltaPercent) < 0.02) return 'praticamente no mesmo patamar';
  return `${percent(deltaPercent)} a ${deltaPercent > 0 ? 'mais' : 'menos'}`;
};

export const NO_DATA = {
  transactions: (periodLabel) =>
    `Não encontrei nenhum lançamento ${periodLabel}. Quer registrar um agora?`,
  future: (periodLabel) =>
    `${capitalize(periodLabel)} ainda não chegou, então não há lançamento para somar.`,
  bills: 'Você não tem contas cadastradas ainda.',
  budgets: 'Você ainda não definiu nenhum orçamento.',
  goals: 'Você ainda não criou nenhuma meta.',
};

export const ERROR_TEXT =
  'Não consegui calcular isso agora. Tente de novo — se persistir, os dados estão nas telas de Relatórios e Contas.';

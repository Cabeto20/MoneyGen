import { normalizeText } from '../normalize';
import { extractPeriod, defaultPeriod } from './period';
import { extractAmount } from './money';
import { extractInstallments } from './installment';
import { extractCategory, extractBillCategory } from './category';
import { extractAccountRef, extractGoalRef, extractBillRef, disambiguateAccountWord } from './reference';

// Verbos que denunciam uma entrada de dinheiro. Fora deles, o padrão é despesa,
// que é a esmagadora maioria do que se digita num app de finanças.
const INCOME_VERBS = /\b(?:recebi|receber|entrou|entrada|ganhei|caiu|creditou|depositaram|deposito)\b/;

/** Substitui o trecho por espaços para os índices dos outros spans continuarem válidos. */
const maskSpan = (text, span) =>
  span ? text.slice(0, span.index) + ' '.repeat(span.length) + text.slice(span.index + span.length) : text;

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * Transforma a frase em entidades tipadas e devolve o resíduo — o texto sem
 * valor, período e parcelas. A classificação usa o resíduo porque em pt-BR
 * coloquial o ruído é justamente numérico e temporal: sem tirá-lo, "posso
 * gastar 800 esse mês" pontua igual para várias intenções.
 */
export const extractEntities = (rawText, refs = {}, now = new Date()) => {
  const text = normalizeText(rawText);
  let masked = text;

  // Parcelas primeiro: senão "parcelar 1200 em 6x" pega o 6 como valor.
  const installments = extractInstallments(masked);
  if (installments) masked = maskSpan(masked, installments.span);

  const periodMatch = extractPeriod(masked, now);
  if (periodMatch) masked = maskSpan(masked, periodMatch.span);

  const amount = extractAmount(masked);
  if (amount) masked = maskSpan(masked, amount.span);

  const type = INCOME_VERBS.test(text) ? 'income' : 'expense';
  const category = extractCategory(text, type);
  const billCategory = extractBillCategory(text);

  const account = extractAccountRef(text, refs.accounts || []);
  const goal = extractGoalRef(text, refs.goals || []);
  const bill = extractBillRef(text, refs.bills || []);

  return {
    text,
    residual: collapse(masked),
    type,
    amount: amount ? amount.value : null,
    installments: installments ? installments.value : null,
    period: periodMatch ? periodMatch.period : null,
    periodOrDefault: periodMatch ? periodMatch.period : defaultPeriod(now),
    category,
    billCategory,
    account: account ? account.item : null,
    goal: goal ? goal.item : null,
    bill: bill ? bill.item : null,
    accountWordSense: disambiguateAccountWord(text),
  };
};

/** Nomes das entidades presentes, para a pontuação das intenções. */
export const presentEntities = (entities) => {
  const present = [];
  if (entities.amount !== null) present.push('amount');
  if (entities.installments !== null) present.push('installments');
  if (entities.period) present.push('period');
  if (entities.category?.confident) present.push('category');
  if (entities.account) present.push('account');
  if (entities.goal) present.push('goal');
  if (entities.bill) present.push('bill');
  return present;
};

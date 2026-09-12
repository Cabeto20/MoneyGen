/**
 * Verificação do motor do assistente sem abrir o app.
 *
 * Funciona porque nada em `entities/`, `resolver.js`, `intents/` e
 * `analytics.js` importa `database/` ou `react-native` — o único acesso a
 * dados é o snapshot, que aqui entra falso.
 *
 * Uso: npm run check-assistant
 */
import { extractEntities } from '../utils/assistant/entities/index.js';
import { resolveIntent } from '../utils/assistant/resolver.js';
import { runIntent } from '../utils/assistant/runner.js';
import { INTENTS } from '../utils/assistant/intents/index.js';
import { PHRASES, ENTITY_CASES, SEMANTIC_PHRASES, OUT_OF_SCOPE_PHRASES } from '../utils/assistant/__fixtures__/phrases.js';
import { semanticMatch } from '../utils/assistant/semantic/index.js';
import { SUGGESTIONS } from '../utils/assistant/suggestions.js';

const NOW = new Date(2026, 8, 10, 14, 0, 0);

const ACCOUNTS = [
  { id: 'acc-default', name: 'Carteira principal', type: 'dinheiro' },
  { id: 'acc-nu', name: 'Nubank', type: 'corrente' },
];

const GOALS = [
  { id: 'g1', name: 'Viagem Chile', targetAmount: 6000, savedAmount: 2400, deadline: '2026-12-31' },
];

const BILLS = [
  { id: 'b1', description: 'Energia', amount: 210, dueDay: 12, category: 'Energia', billType: 'fixa', paidMonths: [], createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'b2', description: 'Internet', amount: 120, dueDay: 20, category: 'Internet', billType: 'fixa', paidMonths: [], createdAt: '2026-01-01T00:00:00.000Z' },
];

const tx = (dateISO, amount, type, category, extra = {}) => ({
  id: `t-${dateISO}-${amount}`, dateISO, amount, type, category, accountId: 'acc-default', ...extra,
});

const TRANSACTIONS = [
  tx('2026-09-02T10:00:00', 1200, 'expense', 'Alimentação'),
  tx('2026-09-05T10:00:00', 300, 'expense', 'Lazer'),
  tx('2026-09-06T10:00:00', 5200, 'income', 'Salário'),
  tx('2026-09-08T10:00:00', 210, 'expense', 'Energia', { billId: 'b1' }),
  tx('2026-08-03T10:00:00', 1000, 'expense', 'Alimentação'),
  tx('2026-08-04T10:00:00', 120, 'expense', 'Lazer'),
  tx('2026-08-08T10:00:00', 150, 'expense', 'Energia', { billId: 'b1' }),
  tx('2026-07-10T10:00:00', 800, 'expense', 'Alimentação'),
];

const fakeSnapshot = {
  now: NOW,
  transactions: async () => TRANSACTIONS,
  bills: async () => BILLS,
  accounts: async () => ACCOUNTS,
  goals: async () => GOALS,
  accountBalances: async () => [
    { ...ACCOUNTS[0], income: 5200, expense: 2980, transactionCount: 8, balance: 2220 },
    { ...ACCOUNTS[1], income: 0, expense: 0, transactionCount: 0, balance: 0 },
  ],
  balance: async () => ({ income: 5200, expense: 2980, balance: 2220 }),
  budgetStatus: async () => [
    { category: 'Alimentação', limit: 1000, spent: 1200, remaining: -200, percent: 1.2, status: 'exceeded' },
    { category: 'Lazer', limit: 400, spent: 300, remaining: 100, percent: 0.75, status: 'ok' },
  ],
};

const REFS = { accounts: ACCOUNTS, goals: GOALS, bills: BILLS };

let failures = 0;
const fail = (message) => { failures += 1; console.log(`  FALHOU  ${message}`); };

console.log('Classificacao de intencao');
for (const item of PHRASES) {
  const entities = extractEntities(item.text, REFS, NOW);
  const resolution = resolveIntent(entities, INTENTS);
  const got = resolution.status === 'fallback' ? 'fallback' : resolution.intent.id;

  if (got !== item.intentId) {
    fail(`"${item.text}"\n          esperado=${item.intentId} obtido=${got}`);
    console.log(`          scores: ${resolution.debug.slice(0, 3).map((d) => `${d.intentId}=${d.score}`).join(' ')}`);
  } else if (item.status && resolution.status !== item.status) {
    fail(`"${item.text}" status esperado=${item.status} obtido=${resolution.status}`);
  }
}

console.log('\nExtracao de entidades');
for (const item of ENTITY_CASES) {
  const e = extractEntities(item.text, REFS, NOW);

  if ('amount' in item && e.amount !== item.amount) {
    fail(`"${item.text}" valor esperado=${item.amount} obtido=${e.amount}`);
  }
  if ('installments' in item && e.installments !== item.installments) {
    fail(`"${item.text}" parcelas esperado=${item.installments} obtido=${e.installments}`);
  }
  if ('category' in item && e.category.value !== item.category) {
    fail(`"${item.text}" categoria esperado=${item.category} obtido=${e.category.value}`);
  }
  if ('type' in item && e.type !== item.type) {
    fail(`"${item.text}" tipo esperado=${item.type} obtido=${e.type}`);
  }
}

console.log('\nRespostas (toda intencao precisa devolver texto)');
for (const item of PHRASES) {
  const entities = extractEntities(item.text, REFS, NOW);
  const resolution = resolveIntent(entities, INTENTS);
  const result = await runIntent(resolution, fakeSnapshot);

  if (!result.text || !result.text.trim()) fail(`"${item.text}" devolveu texto vazio`);
  if (!Array.isArray(result.blocks) || result.blocks.length === 0) {
    fail(`"${item.text}" devolveu sem blocos`);
  }
  if (result.status === 'error') fail(`"${item.text}" caiu no caminho de erro`);

  // Comando de escrita nunca responde direto: tem que devolver uma ação
  // pendente para a tela confirmar antes de gravar.
  const isCommand = ['add_expense', 'add_income', 'pay_bill'].includes(item.intentId);
  if (isCommand && result.status === 'ok') {
    fail(`"${item.text}" gravaria sem confirmacao (status=ok, sem acao)`);
  }
  if (result.status === 'pending-action') {
    if (!result.action) fail(`"${item.text}" marcou acao pendente sem acao`);
    else if (!result.action.type) fail(`"${item.text}" acao pendente sem tipo`);
  }
}


// A camada semantica so entra depois que o motor lexico desiste, entao cada
// frase e cobrada duas vezes: o lexico TEM que falhar (senao a fixture esta no
// lugar errado, medindo o motor antigo) e o resgate TEM que acertar.
console.log('\nCamada semantica (resgate do fallback)');
for (const item of SEMANTIC_PHRASES) {
  const entities = extractEntities(item.text, REFS, NOW);
  const lexical = resolveIntent(entities, INTENTS);

  if (lexical.status !== 'fallback') {
    fail(`"${item.text}" nao e caso de camada 2: o lexico ja resolve (=${lexical.intent.id})`);
    continue;
  }

  const result = await runIntent(lexical, fakeSnapshot);

  if (result.intentId !== item.intentId) {
    const match = await semanticMatch(entities.text);
    const got = match ? `${match.intentId} (cos=${match.score.toFixed(3)} cob=${match.coverage.toFixed(2)})` : 'nenhum match';
    fail(`"${item.text}"\n          esperado=${item.intentId} obtido=${result.intentId} | semantico: ${got}`);
  } else if (result.via !== 'semantic') {
    fail(`"${item.text}" acertou a intencao mas nao pelo caminho semantico`);
  }
}

console.log('\nFora de alcance (nao pode ser resgatada)');
for (const text of OUT_OF_SCOPE_PHRASES) {
  const entities = extractEntities(text, REFS, NOW);
  const result = await runIntent(resolveIntent(entities, INTENTS), fakeSnapshot);

  if (result.intentId !== 'fallback') {
    const match = await semanticMatch(entities.text);
    const got = match ? `cos=${match.score.toFixed(3)} cob=${match.coverage.toFixed(2)} ~ "${match.matched}"` : '?';
    fail(`"${text}" foi resgatada para ${result.intentId} | ${got}`);
  }
}


// Cada chip declara a intencao que o texto dele aciona, e a camada 1 ordena o
// cardapio por essa declaracao. Se o motor mudar e um chip passar a acionar
// outra coisa, a ordenacao por uso passa a contar a intencao errada em
// silencio -- entao a declaracao e cobrada aqui contra o motor de verdade.
console.log('\nChips do cardapio (texto x intencao declarada)');
for (const key of Object.keys(SUGGESTIONS)) {
  const chip = SUGGESTIONS[key];

  if (!chip.intentId) {
    fail(`chip "${key}" sem intentId declarado`);
    continue;
  }

  const entities = extractEntities(chip.text, REFS, NOW);
  const resolution = resolveIntent(entities, INTENTS);
  const got = resolution.status === 'fallback' ? 'fallback' : resolution.intent.id;

  if (got !== chip.intentId) {
    fail(`chip "${key}" ("${chip.text}") declara ${chip.intentId} mas aciona ${got}`);
  }
}

console.log('\n' + '-'.repeat(52));
if (failures === 0) {
  console.log(`OK: ${PHRASES.length} frases lexicas, ${SEMANTIC_PHRASES.length} semanticas, ${OUT_OF_SCOPE_PHRASES.length} fora de alcance, ${Object.keys(SUGGESTIONS).length} chips, ${ENTITY_CASES.length} casos de entidade.`);
} else {
  console.log(`${failures} verificacao(oes) falharam.`);
  process.exit(1);
}

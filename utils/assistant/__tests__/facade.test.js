import * as assistant from '../index';

/**
 * Fumaça do grafo de módulos do assistente.
 *
 * Existe por causa de um caminho de import errado que passou por toda a suíte:
 * `snapshot.js` apontava para `../memory/` em vez de `./memory/`, e nada
 * importava o `snapshot.js` de verdade — os testes de tela zombam da fachada e
 * o `check-assistant` usa um snapshot falso. O erro só apareceu no Metro,
 * depois de quatro minutos de Gradle.
 *
 * Importar a fachada real puxa o grafo inteiro (snapshot, database, memória,
 * semântica, intenções), então qualquer caminho quebrado aparece aqui. Não
 * testa comportamento: testa que o app ainda monta.
 */

const EXPORTED_FUNCTIONS = [
  'askAssistant',
  'runPendingAction',
  'getInsights',
  'executeAction',
  'isExpired',
  'warmSemanticIndex',
  'setEmbedderFactory',
  'hydrateMemory',
  'getMemory',
  'forgetEverything',
  'unlearnPhrase',
];

describe('fachada do assistente', () => {
  it.each(EXPORTED_FUNCTIONS)('exporta %s', (name) => {
    expect(typeof assistant[name]).toBe('function');
  });

  it('exporta o catálogo de sugestões que a tela consome', () => {
    expect(Array.isArray(assistant.DEFAULT_SUGGESTIONS)).toBe(true);
    expect(Array.isArray(assistant.CAPABILITY_GROUPS)).toBe(true);
    expect(assistant.SUGGESTIONS.balance.text).toBeTruthy();
  });

  it('responde uma pergunta de ponta a ponta, com a base vazia', async () => {
    const result = await assistant.askAssistant('quanto tenho?');

    expect(result.intentId).toBe('balance_now');
    expect(result.text).toBeTruthy();
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it('cai no cardápio quando não entende, em vez de estourar', async () => {
    const result = await assistant.askAssistant('qual a capital da França');

    expect(result.intentId).toBe('fallback');
    expect(result.text).toBeTruthy();
  });
});

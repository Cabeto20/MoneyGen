import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hydrateMemory,
  learnPhrase,
  unlearnPhrase,
  recordIntentUse,
  getMemory,
  forgetEverything,
  resetMemoryCache,
} from '../index';
import { semanticMatch, resetSemanticIndex } from '../../semantic';
import { orderedCapabilityGroups, fallbackSuggestions, SUGGESTIONS } from '../../suggestions';

// Frase escolhida para não encostar em nada do corpus escrito à mão: o teste
// precisa provar que foi o aprendizado que mudou o resultado, não o corpus.
const FRASE = 'manda o veredito do juiz';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetMemoryCache();
  resetSemanticIndex();
});

afterAll(() => {
  resetMemoryCache();
  resetSemanticIndex();
});

describe('ciclo de aprendizado de frase', () => {
  it('não conhece a frase antes de aprender', async () => {
    await hydrateMemory();
    expect(await semanticMatch(FRASE)).toBeNull();
  });

  it('passa a reconhecer depois de aprender', async () => {
    await learnPhrase(FRASE, 'period_summary');

    const match = await semanticMatch(FRASE);
    expect(match?.intentId).toBe('period_summary');
  });

  // O aprendizado entra no índice em vez de numa tabela de igualdade: ensinar
  // uma vez precisa valer para a variação seguinte, não só para a frase exata.
  it('generaliza para uma variação da frase ensinada', async () => {
    await learnPhrase(FRASE, 'period_summary');

    const match = await semanticMatch('manda o veredito do juiz ai');
    expect(match?.intentId).toBe('period_summary');
  });

  it('sobrevive a recarregar do armazenamento', async () => {
    await learnPhrase(FRASE, 'period_summary');

    resetMemoryCache();
    resetSemanticIndex();
    await hydrateMemory();

    expect((await semanticMatch(FRASE))?.intentId).toBe('period_summary');
  });

  it('esquece quando mandado', async () => {
    await learnPhrase(FRASE, 'period_summary');
    await unlearnPhrase(FRASE);

    expect(await semanticMatch(FRASE)).toBeNull();
  });

  it('corrige a lição quando a mesma frase é reensinada', async () => {
    await learnPhrase(FRASE, 'period_summary');
    await learnPhrase(FRASE, 'bills_due');

    expect((await semanticMatch(FRASE))?.intentId).toBe('bills_due');
    expect(getMemory().phrases).toHaveLength(1);
  });

  // A trava que importa: nenhuma frase mal entendida pode virar sugestão de
  // gravar dinheiro, por mais que o usuário insista.
  it('se recusa a aprender intenção de escrita', async () => {
    await learnPhrase(FRASE, 'add_expense');

    expect(getMemory().phrases).toHaveLength(0);
    expect(await semanticMatch(FRASE)).toBeNull();
  });

  it('se recusa a aprender frase de uma palavra', async () => {
    await learnPhrase('opa', 'balance_now');
    expect(getMemory().phrases).toHaveLength(0);
  });

  it('esquece tudo', async () => {
    await learnPhrase(FRASE, 'period_summary');
    await recordIntentUse('bills_due');

    await forgetEverything();

    expect(getMemory().phrases).toHaveLength(0);
    expect(getMemory().intentUses).toEqual({});
    expect(await semanticMatch(FRASE)).toBeNull();
  });
});

describe('cardápio ordenado pelo uso', () => {
  it('sai na ordem escrita à mão quando não há histórico', async () => {
    await hydrateMemory();

    const primeiro = orderedCapabilityGroups()[0];
    expect(primeiro.items[0].id).toBe(SUGGESTIONS.balance.id);
  });

  it('põe na frente o que o usuário mais pergunta', async () => {
    // `topCategories` é o terceiro do primeiro grupo na ordem escrita à mão.
    await recordIntentUse('top_categories');
    await recordIntentUse('top_categories');

    const primeiro = orderedCapabilityGroups()[0];
    expect(primeiro.items[0].id).toBe(SUGGESTIONS.topCategories.id);
  });

  it('ordena também as sugestões do fallback', async () => {
    await recordIntentUse('insights');
    await recordIntentUse('insights');

    expect(fallbackSuggestions([])[0].id).toBe(SUGGESTIONS.insights.id);
  });

  it('não conta turno que não virou resposta', async () => {
    await recordIntentUse('fallback');
    // `fallback` não é intenção de verdade, mas mesmo assim a contagem não pode
    // derrubar a ordenação de quem é.
    expect(orderedCapabilityGroups()[0].items[0].id).toBe(SUGGESTIONS.balance.id);
  });
});

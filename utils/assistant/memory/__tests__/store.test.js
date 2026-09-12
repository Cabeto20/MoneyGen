import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  EMPTY_MEMORY,
  MAX_PHRASES,
  canLearn,
  rememberPhrase,
  forgetPhrase,
  countIntentUse,
  learnedEntries,
  loadMemory,
  saveMemory,
  clearMemory,
} from '../store';

const NOW = new Date('2026-09-11T12:00:00.000Z');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('canLearn', () => {
  it('aceita frase de duas palavras ou mais', () => {
    expect(canLearn('to no sufoco', 'leftover_after_bills')).toBe(true);
  });

  // Uma palavra solta gruda em qualquer coisa: "oi" ligado a uma consulta faria
  // todo cumprimento virar resposta de saldo.
  it('recusa frase de uma palavra só', () => {
    expect(canLearn('oi', 'balance_now')).toBe(false);
    expect(canLearn('   ', 'balance_now')).toBe(false);
  });

  it('recusa intenção de escrita, que grava dinheiro', () => {
    expect(canLearn('lanca ai pra mim', 'add_expense')).toBe(false);
    expect(canLearn('paga essa conta', 'pay_bill')).toBe(false);
  });

  it('recusa sem intenção', () => {
    expect(canLearn('to no sufoco', null)).toBe(false);
  });
});

describe('rememberPhrase', () => {
  it('guarda a frase normalizada, não o que foi digitado', () => {
    const memory = rememberPhrase(EMPTY_MEMORY, 'Tô No SUFOCO!', 'leftover_after_bills', NOW);
    expect(memory.phrases).toHaveLength(1);
    expect(memory.phrases[0].text).toBe('to no sufoco');
  });

  it('não muda a memória quando a frase é recusada', () => {
    expect(rememberPhrase(EMPTY_MEMORY, 'oi', 'balance_now', NOW)).toBe(EMPTY_MEMORY);
  });

  it('soma quando a mesma frase reforça a mesma intenção', () => {
    let memory = rememberPhrase(EMPTY_MEMORY, 'to no sufoco', 'leftover_after_bills', NOW);
    memory = rememberPhrase(memory, 'to no sufoco', 'leftover_after_bills', NOW);
    expect(memory.phrases).toHaveLength(1);
    expect(memory.phrases[0].count).toBe(2);
  });

  // A lição nova é a correção da antiga: somar as duas deixaria o assistente
  // preso ao erro que o usuário acabou de corrigir.
  it('sobrescreve e zera a contagem quando a intenção muda', () => {
    let memory = rememberPhrase(EMPTY_MEMORY, 'to no sufoco', 'balance_now', NOW);
    memory = rememberPhrase(memory, 'to no sufoco', 'balance_now', NOW);
    memory = rememberPhrase(memory, 'to no sufoco', 'leftover_after_bills', NOW);

    expect(memory.phrases).toHaveLength(1);
    expect(memory.phrases[0].intentId).toBe('leftover_after_bills');
    expect(memory.phrases[0].count).toBe(1);
  });

  it('poda no teto, mantendo as mais repetidas', () => {
    let memory = rememberPhrase(EMPTY_MEMORY, 'frase preferida', 'balance_now', NOW);
    for (let i = 0; i < 5; i += 1) {
      memory = rememberPhrase(memory, 'frase preferida', 'balance_now', NOW);
    }

    for (let i = 0; i < MAX_PHRASES + 10; i += 1) {
      memory = rememberPhrase(memory, `frase numero ${i}`, 'balance_now', NOW);
    }

    expect(memory.phrases).toHaveLength(MAX_PHRASES);
    expect(memory.phrases.map((phrase) => phrase.text)).toContain('frase preferida');
  });
});

describe('forgetPhrase e countIntentUse', () => {
  it('esquece pela forma normalizada', () => {
    const memory = rememberPhrase(EMPTY_MEMORY, 'to no sufoco', 'leftover_after_bills', NOW);
    expect(forgetPhrase(memory, 'Tô No Sufoco').phrases).toHaveLength(0);
  });

  it('conta o uso por intenção', () => {
    let memory = countIntentUse(EMPTY_MEMORY, 'balance_now');
    memory = countIntentUse(memory, 'balance_now');
    memory = countIntentUse(memory, 'bills_due');

    expect(memory.intentUses).toEqual({ balance_now: 2, bills_due: 1 });
  });

  it('devolve as frases na forma que o índice semântico consome', () => {
    const memory = rememberPhrase(EMPTY_MEMORY, 'to no sufoco', 'leftover_after_bills', NOW);
    expect(learnedEntries(memory)).toEqual([
      { intentId: 'leftover_after_bills', text: 'to no sufoco' },
    ]);
  });
});

describe('persistência', () => {
  it('grava e relê', async () => {
    const memory = rememberPhrase(EMPTY_MEMORY, 'to no sufoco', 'leftover_after_bills', NOW);
    await saveMemory(memory);

    const loaded = await loadMemory();
    expect(loaded.phrases[0].text).toBe('to no sufoco');
  });

  it('devolve memória vazia quando não há nada gravado', async () => {
    expect(await loadMemory()).toEqual(EMPTY_MEMORY);
  });

  it('não quebra com JSON corrompido', async () => {
    await AsyncStorage.setItem('assistantMemory', 'isto não é json');
    expect(await loadMemory()).toEqual(EMPTY_MEMORY);
  });

  // A regra pode endurecer depois de algo já ter sido gravado — a validação na
  // leitura é o que impede uma lição velha de sobreviver à mudança.
  it('descarta na leitura o que hoje não seria aprendido', async () => {
    await AsyncStorage.setItem(
      'assistantMemory',
      JSON.stringify({
        version: 1,
        phrases: [
          { text: 'to no sufoco', intentId: 'leftover_after_bills', count: 1, updatedAt: '2026-01-01' },
          { text: 'oi', intentId: 'balance_now', count: 1, updatedAt: '2026-01-01' },
          { text: 'lanca ai', intentId: 'add_expense', count: 1, updatedAt: '2026-01-01' },
        ],
        intentUses: { balance_now: 3, quebrado: 'nao e numero' },
      })
    );

    const loaded = await loadMemory();
    expect(loaded.phrases.map((phrase) => phrase.text)).toEqual(['to no sufoco']);
    expect(loaded.intentUses).toEqual({ balance_now: 3 });
  });

  it('apaga tudo', async () => {
    await saveMemory(rememberPhrase(EMPTY_MEMORY, 'to no sufoco', 'balance_now', NOW));
    await clearMemory();
    expect(await AsyncStorage.getItem('assistantMemory')).toBeNull();
  });
});

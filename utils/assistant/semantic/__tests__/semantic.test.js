import { createLexicalEmbedder, cosine } from '../embedder';
import {
  semanticMatch,
  resetSemanticIndex,
  setEmbedderFactory,
  MIN_SIMILARITY,
} from '../index';
import { CORPUS, CORPUS_ENTRIES, WRITE_INTENTS, OUT_OF_SCOPE_INTENT } from '../corpus';
import { INTENT_BY_ID } from '../../intents';

afterEach(() => {
  setEmbedderFactory(null);
  resetSemanticIndex();
});

describe('embedder léxico', () => {
  const embedder = createLexicalEmbedder(['quanto sobra depois de pagar as contas']);

  it('devolve vetor unitário', () => {
    const vector = embedder.embed('quanto tenho');
    expect(cosine(vector, vector)).toBeCloseTo(1, 5);
  });

  it('é insensível a acento, caixa e pontuação', () => {
    const a = embedder.embed('Quanto Sobra, Depois?');
    const b = embedder.embed('quanto sobra depois');
    expect(cosine(a, b)).toBeCloseTo(1, 5);
  });

  // O n-grama cobre letra trocada, dobrada ou faltando. O que ele não cobre é
  // o erro numa frase curta: em duas palavras, uma errada é metade do sinal, e
  // aí nem o n-grama salva. Por isso a medida é sobre frase de tamanho real.
  it('tolera erro de digitação', () => {
    const certo = embedder.embed('quanto sobra depois de pagar as contas');
    const errado = embedder.embed('quanto sorba depois de pagar as contas');
    expect(cosine(certo, errado)).toBeGreaterThan(0.6);
  });

  it('não acha similaridade onde não há', () => {
    const a = embedder.embed('quanto sobra depois de pagar as contas');
    const b = embedder.embed('qual a capital da franca');
    expect(cosine(a, b)).toBeLessThan(MIN_SIMILARITY);
  });

  it('devolve vetor zerado sem explodir quando a frase não tem token', () => {
    expect(() => embedder.embed('...')).not.toThrow();
  });
});

describe('corpus', () => {
  it('só aponta para intenção que existe', () => {
    Object.keys(CORPUS)
      .filter((intentId) => intentId !== OUT_OF_SCOPE_INTENT)
      .forEach((intentId) => {
        expect(INTENT_BY_ID[intentId]).toBeDefined();
      });
  });

  // A garantia de que uma frase mal entendida nunca vira sugestão de gravar
  // dinheiro. Se alguém adicionar paráfrase de comando aqui, o teste quebra.
  it('não contém intenção de escrita', () => {
    WRITE_INTENTS.forEach((intentId) => {
      expect(CORPUS[intentId]).toBeUndefined();
    });
  });

  it('não repete a mesma frase em duas intenções', () => {
    const seen = new Map();
    CORPUS_ENTRIES.forEach(({ text, intentId }) => {
      if (seen.has(text)) {
        expect(`${text} (${seen.get(text)} e ${intentId})`).toBe('sem duplicata');
      }
      seen.set(text, intentId);
    });
  });
});

describe('semanticMatch', () => {
  it('acha a intenção de uma frase vizinha, que não está no corpus', async () => {
    const match = await semanticMatch('to no sufoco esse mes');
    expect(match?.intentId).toBe('leftover_after_bills');
  });

  it('devolve null para frase de outro assunto', async () => {
    expect(await semanticMatch('qual a capital da franca')).toBeNull();
    expect(await semanticMatch('me conta uma piada')).toBeNull();
  });

  it('devolve null para texto vazio', async () => {
    expect(await semanticMatch('')).toBeNull();
    expect(await semanticMatch('   ')).toBeNull();
  });

  it('nunca devolve a turma de fora de alcance como resposta', async () => {
    const match = await semanticMatch('bom dia tudo bem');
    expect(match).toBeNull();
  });

  it('respeita a lista de intenções permitidas', async () => {
    const livre = await semanticMatch('to no sufoco esse mes');
    expect(livre.intentId).toBe('leftover_after_bills');

    const restrito = await semanticMatch('to no sufoco esse mes', ['top_categories']);
    expect(restrito).toBeNull();
  });

  // O contrato do embedder precisa aceitar modelo assíncrono — é assim que um
  // modelo local entra no lugar do léxico sem mexer no resto.
  it('aceita fábrica e embed assíncronos', async () => {
    setEmbedderFactory(async (documents) => {
      const inner = createLexicalEmbedder(documents);
      return {
        embed: async (text) => inner.embed(text),
        coverage: (text) => inner.coverage(text),
      };
    });
    resetSemanticIndex();

    const match = await semanticMatch('to no sufoco esse mes');
    expect(match?.intentId).toBe('leftover_after_bills');
  });

  it('não deixa índice quebrado em cache quando o embedder falha', async () => {
    setEmbedderFactory(() => {
      throw new Error('modelo indisponivel');
    });
    resetSemanticIndex();

    await expect(semanticMatch('to no sufoco')).rejects.toThrow('modelo indisponivel');

    setEmbedderFactory(null);
    const match = await semanticMatch('to no sufoco esse mes');
    expect(match?.intentId).toBe('leftover_after_bills');
  });
});

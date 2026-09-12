import { normalizeText, tokenize } from '../normalize';

/**
 * Frase -> vetor denso, em JS puro e sem asset nenhum.
 *
 * O contrato é o mesmo de um modelo de embedding de verdade (`embed(texto)`
 * devolve um vetor normalizado), para o dia em que entrar um modelo local no
 * lugar deste a troca ser de uma linha — ver `setEmbedderFactory`. Enquanto
 * isso, quem carrega a semântica é o corpus de paráfrases, não o vetor: este
 * embedder generaliza morfologia, plural e erro de digitação, não sinônimo.
 */

// Colisão de hash é o preço de manter o vetor denso (compatível com modelo).
// Com ~50 traços por frase, 1024 casas deixam a colisão irrelevante.
export const DIM = 1024;

const TOKEN_WEIGHT = 1;
const BIGRAM_WEIGHT = 0.8;
// Muitos n-gramas por palavra: peso baixo em cada um para não afogar o token.
const GRAM_WEIGHT = 0.3;
const GRAM_SIZE = 4;
// Ver o comentário de `idf`: é a gangorra entre tolerar erro de digitação e
// afastar frase de outro assunto. Varrido de 1,0 a 0,5 contra as fixtures —
// 0,7 é onde o vão entre a pior frase legítima e a melhor frase de fora fica
// mais largo (0,375 contra 0,263), e ainda por cima tolera 44% mais erro de
// digitação que o peso cheio.
const UNKNOWN_IDF_SCALE = 0.7;

const hashFeature = (key) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// `normalizeText` preserva `.` `,` `/` `-` porque valor e data dependem deles
// ("1.234,56", "12/07"). O efeito colateral é a pontuação grudar no fim da
// palavra: sem aparar, "sobra," e "sobra" viram traços diferentes e a mesma
// frase com e sem vírgula deixa de ser a mesma frase. Só as bordas são
// aparadas — o miolo do número continua intacto.
const trimPunctuation = (token) => token.replace(/^[.,/-]+/, '').replace(/[.,/-]+$/, '');

/**
 * Traços da frase. O `^`/`$` em volta do token faz o n-grama enxergar começo e
 * fim de palavra — sem isso "gasto" e "gastou" ficam quase idênticos a
 * "desgaste", que é ruído vindo do meio da palavra.
 */
const featuresOf = (text) => {
  const tokens = tokenize(normalizeText(text)).map(trimPunctuation).filter(Boolean);
  const features = [];

  tokens.forEach((token, index) => {
    features.push({ key: `t:${token}`, weight: TOKEN_WEIGHT });

    // Ordem importa em pt-BR: "posso gastar" e "gastar posso" não são a mesma
    // pergunta, e só o bigrama registra isso.
    if (index > 0) {
      features.push({ key: `b:${tokens[index - 1]}~${token}`, weight: BIGRAM_WEIGHT });
    }

    const padded = `^${token}$`;
    if (padded.length <= GRAM_SIZE) {
      features.push({ key: `g:${padded}`, weight: GRAM_WEIGHT });
    } else {
      for (let i = 0; i + GRAM_SIZE <= padded.length; i += 1) {
        features.push({ key: `g:${padded.slice(i, i + GRAM_SIZE)}`, weight: GRAM_WEIGHT });
      }
    }
  });

  return features;
};

const l2Normalize = (vector) => {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  const norm = Math.sqrt(sum);
  if (norm === 0) return vector;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
};

/** Os dois vetores já saem normalizados, então o cosseno é só o produto. */
export const cosine = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
};

/**
 * Monta o embedder ajustado ao corpus. O IDF é o que faz "quanto" e "de"
 * pesarem pouco sem precisar de lista de stopword em pt-BR: aparecendo em
 * quase toda frase do corpus, o próprio peso desaba.
 */
export const createLexicalEmbedder = (documents = []) => {
  const documentFrequency = new Map();

  documents.forEach((document) => {
    const seen = new Set(featuresOf(document).map((feature) => feature.key));
    seen.forEach((key) => documentFrequency.set(key, (documentFrequency.get(key) || 0) + 1));
  });

  const total = Math.max(documents.length, 1);
  const maxIdf = Math.log(1 + total);

  // Traço que o corpus nunca viu entra pesado de propósito: ele não casa com
  // nada e dilui o vetor, e é essa diluição que afasta frase de outro assunto.
  // Zerá-lo faria "qual a capital da França" virar quase igual a "qual o
  // saldo" — sobraria só o "qual".
  //
  // Mas no peso cheio ele também mata a tolerância a erro de digitação: em
  // "quanto sobrra", a palavra errada é desconhecida, leva o IDF máximo e
  // sozinha domina o vetor, apagando o que os n-gramas ainda reconhecem. Daí o
  // desconto do `UNKNOWN_IDF_SCALE`: dá para afrouxar porque quem barra frase
  // de outro assunto hoje é a turma `out_of_scope` do corpus, não esta
  // diluição — ela virou o segundo freio, não o primeiro.
  const idf = (key) => {
    const seen = documentFrequency.get(key);
    return seen ? Math.log(1 + total / seen) : maxIdf * UNKNOWN_IDF_SCALE;
  };

  const embed = (text) => {
    const vector = new Float32Array(DIM);

    featuresOf(text).forEach(({ key, weight }) => {
      const hash = hashFeature(key);
      // Sinal vindo de um bit alto e casa vinda dos baixos: bits diferentes,
      // senão metade das casas nunca receberia valor negativo.
      const sign = (hash >>> 20) & 1 ? -1 : 1;
      vector[hash % DIM] += sign * weight * idf(key);
    });

    return l2Normalize(vector);
  };

  /** Quanto da frase o corpus reconhece. Vale como freio à parte do cosseno. */
  const coverage = (text) => {
    const words = featuresOf(text).filter((feature) => feature.key.startsWith('t:'));
    if (words.length === 0) return 0;
    const known = words.filter((feature) => documentFrequency.has(feature.key)).length;
    return known / words.length;
  };

  return { embed, coverage, dimension: DIM };
};

let factory = createLexicalEmbedder;

/**
 * Ponto de troca para um embedder de modelo local (ExecuTorch, por exemplo).
 *
 * A injeção é assim, e não um `import` do pacote nativo aqui dentro, porque
 * este módulo precisa continuar rodando no Node do `check-assistant` e no Jest,
 * onde não existe binding nativo nenhum. A fábrica pode ser assíncrona e o
 * `embed` pode devolver Promise — o índice espera os dois.
 */
export const setEmbedderFactory = (next) => {
  factory = next || createLexicalEmbedder;
};

export const getEmbedderFactory = () => factory;

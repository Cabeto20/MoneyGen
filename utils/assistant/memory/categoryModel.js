import { normalizeText, tokenize } from '../normalize';

/**
 * Naive Bayes multinomial sobre a descrição do lançamento.
 *
 * O conjunto de treino é o próprio histórico do usuário: cada transação que ele
 * já categorizou é um exemplo rotulado. Por isso o modelo não é guardado em
 * lugar nenhum — persisti-lo seria duplicar uma informação que já está na base,
 * e numa base que reescreve o JSON inteiro a cada operação a cópia sai cara e
 * envelhece sozinha. Treinar custa um passe sobre a lista, que o snapshot já
 * carregou de qualquer forma.
 *
 * O que ele acrescenta à tabela estática de `utils/categories.js`: a padaria da
 * esquina, o mercado do bairro, o apelido que só este usuário usa. Nada disso
 * cabe numa lista fixa, e é exatamente o que ele digita todo dia.
 */

// Abaixo disso o histórico não sustenta palpite: com 5 lançamentos, o primeiro
// mercado visto viraria regra para qualquer palavra parecida.
const MIN_EXAMPLES = 12;
// Uma categoria vista uma vez só é ruído — quase sempre um lançamento avulso.
const MIN_PER_CATEGORY = 2;
// Probabilidade mínima da classe vencedora, depois de normalizada.
const MIN_CONFIDENCE = 0.65;
// Token de 1 ou 2 letras ("de", "no", "pg") não distingue categoria nenhuma.
const MIN_TOKEN_LENGTH = 3;

/** Só o que descreve: número, data e conectivo curto não carregam categoria. */
const usefulTokens = (text) =>
  tokenize(normalizeText(text)).filter(
    (token) => token.length >= MIN_TOKEN_LENGTH && !/^[\d.,/-]+$/.test(token)
  );

const emptyModel = { ready: false, predict: () => null };

/**
 * Treina um modelo por tipo (`expense` / `income`). Ficam separados porque as
 * categorias não se misturam: "Salário" nunca é resposta para uma despesa, e um
 * modelo único gastaria massa de probabilidade com classes impossíveis.
 */
const trainOne = (rows) => {
  const tokenCountByCategory = new Map();
  const totalTokensByCategory = new Map();
  const docsByCategory = new Map();
  const vocabulary = new Set();
  let documents = 0;

  rows.forEach(({ category, tokens }) => {
    if (tokens.length === 0) return;

    documents += 1;
    docsByCategory.set(category, (docsByCategory.get(category) || 0) + 1);

    if (!tokenCountByCategory.has(category)) tokenCountByCategory.set(category, new Map());
    const counts = tokenCountByCategory.get(category);

    tokens.forEach((token) => {
      counts.set(token, (counts.get(token) || 0) + 1);
      vocabulary.add(token);
      totalTokensByCategory.set(category, (totalTokensByCategory.get(category) || 0) + 1);
    });
  });

  // Categoria rara sai do modelo inteiro, não só do resultado: deixá-la
  // competindo rouba massa de probabilidade das que têm evidência de verdade.
  const categories = [...docsByCategory.keys()].filter(
    (category) => docsByCategory.get(category) >= MIN_PER_CATEGORY
  );

  if (documents < MIN_EXAMPLES || categories.length < 2) return emptyModel;

  const vocabularySize = vocabulary.size;

  const predict = (text) => {
    const tokens = usefulTokens(text);
    // Sem nenhuma palavra conhecida, o resultado seria só o a priori — ou seja,
    // a categoria mais frequente, dita com cara de palpite informado.
    const known = tokens.filter((token) => vocabulary.has(token));
    if (known.length === 0) return null;

    const scores = categories.map((category) => {
      const counts = tokenCountByCategory.get(category);
      const total = totalTokensByCategory.get(category) || 0;
      // Laplace: token nunca visto naquela categoria não pode zerar o produto.
      const denominator = total + vocabularySize;

      let score = Math.log(docsByCategory.get(category) / documents);
      known.forEach((token) => {
        score += Math.log(((counts.get(token) || 0) + 1) / denominator);
      });

      return { category, score };
    });

    scores.sort((a, b) => b.score - a.score);

    // Normaliza subtraindo o maior antes de exponenciar: as log-probabilidades
    // de uma frase longa ficam bem negativas e `Math.exp` devolveria 0 em todas.
    const top = scores[0].score;
    const weights = scores.map((item) => Math.exp(item.score - top));
    const sum = weights.reduce((acc, weight) => acc + weight, 0);
    const confidence = weights[0] / sum;

    if (confidence < MIN_CONFIDENCE) return null;
    return { category: scores[0].category, confidence };
  };

  return { ready: true, predict };
};

export const trainCategoryModel = (transactions = []) => {
  const byType = { expense: [], income: [] };

  transactions.forEach((transaction) => {
    const category = transaction?.category;
    const type = transaction?.type;
    if (!category || !byType[type]) return;

    const tokens = usefulTokens(transaction.description || '');
    if (tokens.length > 0) byType[type].push({ category, tokens });
  });

  const models = { expense: trainOne(byType.expense), income: trainOne(byType.income) };

  return {
    ready: models.expense.ready || models.income.ready,
    predict: (text, type = 'expense') => (models[type] || emptyModel).predict(text),
  };
};

export const EMPTY_CATEGORY_MODEL = emptyModel;

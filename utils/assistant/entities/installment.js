const NUMBER_WORDS = {
  duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20,
};

const PATTERNS = [
  /\b(\d{1,3})\s*x\b/,
  /\bem (\d{1,3}|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte) (?:vezes|parcelas|prestacoes)\b/,
  /\b(\d{1,3}|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte) (?:vezes|parcelas|prestacoes)\b/,
];

/**
 * Número de parcelas. Roda ANTES da extração de valor: sem isso, "parcelar
 * 1200 em 6x" pegaria o 6 como valor.
 */
export const extractInstallments = (normalizedText) => {
  for (let i = 0; i < PATTERNS.length; i += 1) {
    const match = normalizedText.match(PATTERNS[i]);
    if (!match) continue;

    const raw = match[1];
    const count = NUMBER_WORDS[raw] || parseInt(raw, 10);
    // Faixa válida pelo intervalo: parseInt devolve NaN e NaN em qualquer
    // comparação é false, então testar o inválido deixaria passar.
    if (count >= 2 && count <= 360) {
      return {
        value: count,
        raw: match[0],
        span: { index: match.index, length: match[0].length },
      };
    }
  }

  return null;
};

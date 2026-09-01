/**
 * Leitura de extratos em TXT no formato: nome / data / valor.
 *
 * O parser é tolerante de propósito, porque cada banco exporta de um jeito:
 *  - separadores: TAB, ";", "|", vírgula (CSV), 2+ espaços ou espaço simples
 *  - ordem das colunas: a data e o valor são identificados pelo conteúdo,
 *    então "nome data valor" e "data nome valor" funcionam igual
 *  - valores: "1.234,56" | "1,234.56" | "-150" | "(150,00)" | "150,00-" | "150,00D"
 *  - datas: dd/MM/aaaa, dd-MM-aa, aaaa-MM-dd, ddMMaaaa, aaaaMMdd
 *
 * Valor negativo => saída (despesa/conta). Valor positivo => entrada (receita).
 */

import { formatDateBR } from './dateHelpers';

const CURRENT_CENTURY = 2000;
const YEAR_PIVOT = 79; // 79 -> 1979, 78 -> 2078

// Palavras-chave para adivinhar a categoria pela descrição.
// A primeira correspondência vence, então termos mais específicos vêm antes.
const EXPENSE_KEYWORDS = [
  ['Alimentação', ['supermercado', 'mercado', 'padaria', 'restaurante', 'lanche', 'ifood', 'rappi', 'açougue', 'acougue', 'hortifruti', 'pizzaria', 'café', 'cafe']],
  ['Transporte', ['uber', '99pop', 'posto', 'combustível', 'combustivel', 'gasolina', 'etanol', 'estacionamento', 'pedágio', 'pedagio', 'ônibus', 'onibus', 'metrô', 'ipva', 'oficina', 'pneu']],
  ['Moradia', ['aluguel', 'condomínio', 'condominio', 'energia', 'elétrica', 'eletrica', 'enel', 'cemig', 'copel', 'light', 'água', 'agua', 'sabesp', 'sanepar', 'gás', 'iptu']],
  ['Saúde', ['farmácia', 'farmacia', 'drogaria', 'clínica', 'clinica', 'hospital', 'médico', 'medico', 'dentista', 'laboratório', 'laboratorio', 'plano de saude', 'unimed', 'exame']],
  ['Educação', ['escola', 'faculdade', 'universidade', 'curso', 'mensalidade', 'livro', 'material escolar', 'udemy', 'alura']],
  ['Lazer', ['netflix', 'spotify', 'disney', 'hbo', 'prime video', 'cinema', 'steam', 'playstation', 'xbox', 'viagem', 'hotel', 'airbnb', 'academia']],
  ['Compras', ['magazine', 'americanas', 'mercado livre', 'mercadolivre', 'shopee', 'aliexpress', 'amazon', 'shopping', 'loja', 'roupa', 'calçado', 'calcado', 'renner', 'riachuelo']],
  ['Serviços', ['internet', 'vivo', 'claro', 'telefone', 'celular', 'assinatura', 'seguro', 'cartório', 'cartorio', 'advogado', 'contador', 'tarifa', 'anuidade', 'juros', 'iof']],
];

const INCOME_KEYWORDS = [
  ['Salário', ['salário', 'salario', 'folha de pagamento', 'holerite', 'proventos']],
  ['Freelance', ['freelance', 'freela', 'prestação de serviço', 'prestacao de servico', 'autônomo', 'autonomo']],
  ['Investimentos', ['rendimento', 'dividendo', 'juros sobre capital', 'jcp', 'resgate', 'aplicação', 'aplicacao', 'cdb', 'tesouro', 'poupança', 'poupanca']],
  ['Vendas', ['venda', 'pix recebido', 'transferência recebida', 'transferencia recebida', 'ted recebida', 'depósito', 'deposito']],
  ['Bonificação', ['bônus', 'bonus', 'bonificação', 'bonificacao', 'comissão', 'comissao', 'plr', 'décimo terceiro', 'decimo terceiro']],
  ['Prêmio', ['prêmio', 'premio', 'sorteio', 'cashback', 'estorno', 'reembolso']],
  ['Aluguel Recebido', ['aluguel recebido', 'locação', 'locacao', 'inquilino']],
];

// A tela de Contas usa um conjunto de categorias diferente do de despesas.
const BILL_KEYWORDS = [
  ['Aluguel', ['aluguel', 'condomínio', 'condominio', 'imobiliária', 'imobiliaria']],
  ['Energia', ['energia', 'elétrica', 'eletrica', 'enel', 'cemig', 'copel', 'light', 'cpfl', 'celesc', 'coelba']],
  ['Água', ['água', 'agua', 'sabesp', 'sanepar', 'cedae', 'caesb', 'embasa']],
  ['Internet', ['internet', 'banda larga', 'fibra', 'wifi']],
  ['Telefone', ['telefone', 'celular', 'vivo', 'claro', 'móvel', 'movel']],
  ['Cartão', ['cartão', 'cartao', 'fatura', 'nubank', 'itaucard', 'visa', 'mastercard']],
  ['Financiamento', ['financiamento', 'empréstimo', 'emprestimo', 'consórcio', 'consorcio', 'parcela', 'prestação', 'prestacao']],
  ['Seguro', ['seguro', 'seguradora', 'proteção', 'protecao']],
];

const COMMENT_PREFIXES = ['#', '//', '--'];
const HEADER_HINTS = ['nome', 'data', 'valor', 'descrição', 'descricao', 'histórico', 'historico', 'lançamento', 'lancamento', 'documento', 'saldo'];

const normalizeYear = (raw) => {
  const year = parseInt(raw, 10);
  if (raw.length === 4) return year;
  return year <= YEAR_PIVOT ? CURRENT_CENTURY + year : 1900 + year;
};

const buildDate = (day, month, year) => {
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  const date = new Date(year, month - 1, day);
  // Rejeita overflow do Date (ex.: 31/02 viraria 03/03).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

/**
 * Converte um token em Date, ou null se não for uma data reconhecível.
 */
export const parseDate = (raw) => {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return null;

  let match = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (match) {
    // dd/MM/aaaa é o padrão brasileiro; MM/dd só é tentado se o dia não fechar.
    return buildDate(+match[1], +match[2], normalizeYear(match[3]))
      || buildDate(+match[2], +match[1], normalizeYear(match[3]));
  }

  match = value.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (match) return buildDate(+match[3], +match[2], +match[1]);

  match = value.match(/^(\d{8})$/);
  if (match) {
    const digits = match[1];
    return buildDate(+digits.slice(0, 2), +digits.slice(2, 4), +digits.slice(4))
      || buildDate(+digits.slice(6), +digits.slice(4, 6), +digits.slice(0, 4));
  }

  return null;
};

/**
 * Converte um token em número com sinal, ou null se não for um valor.
 * O sinal é o que decide entre entrada e saída.
 */
export const parseAmount = (raw) => {
  let value = String(raw == null ? '' : raw).trim();
  if (!value) return null;

  let negative = false;

  // Padrão contábil: (150,00) é negativo.
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1).trim();
  }

  value = value.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!value) return null;

  // Sufixo D (débito) / C (crédito) usado por alguns extratos.
  const suffix = value.match(/([DC])$/i);
  if (suffix) {
    if (suffix[1].toUpperCase() === 'D') negative = true;
    value = value.slice(0, -1);
  }

  // Sinal no fim: "150,00-"
  if (value.endsWith('-')) {
    negative = true;
    value = value.slice(0, -1);
  }
  if (value.startsWith('+')) value = value.slice(1);
  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  }

  if (!/^[\d.,]+$/.test(value) || !/\d/.test(value)) return null;

  // Descobre qual símbolo é o separador decimal.
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  let decimalSep = null;

  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    // Vírgula única com 1 ou 2 casas é decimal; o resto é separador de milhar.
    const fractionLength = value.length - lastComma - 1;
    if (value.indexOf(',') === lastComma && fractionLength >= 1 && fractionLength <= 2) decimalSep = ',';
  } else if (lastDot >= 0) {
    const fractionLength = value.length - lastDot - 1;
    if (value.indexOf('.') === lastDot && fractionLength >= 1 && fractionLength <= 2) decimalSep = '.';
  }

  let integerPart = value;
  let fractionPart = '';
  if (decimalSep) {
    const index = value.lastIndexOf(decimalSep);
    integerPart = value.slice(0, index);
    fractionPart = value.slice(index + 1);
  }

  integerPart = integerPart.replace(/[.,]/g, '');
  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null;
  if (!integerPart && !fractionPart) return null;

  const parsed = parseFloat(`${integerPart || '0'}.${fractionPart || '0'}`);
  if (!isFinite(parsed)) return null;

  return negative ? -parsed : parsed;
};

const matchKeyword = (description, table, fallback) => {
  const haystack = description.toLowerCase();
  for (const [category, keywords] of table) {
    if (keywords.some(keyword => haystack.includes(keyword))) return category;
  }
  return fallback;
};

export const guessCategory = (description, type) =>
  type === 'income'
    ? matchKeyword(description, INCOME_KEYWORDS, 'Outros')
    : matchKeyword(description, EXPENSE_KEYWORDS, 'Serviços');

export const guessBillCategory = (description) =>
  matchKeyword(description, BILL_KEYWORDS, 'Cartão');

/**
 * Quebra a linha em colunas, escolhendo o separador que a linha realmente usa.
 */
const tokenize = (line) => {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  if (line.includes('|')) return line.split('|');

  // Vírgula só vira separador quando não está quebrando o decimal do valor.
  if (line.includes(',')) {
    const commaParts = line.split(',');
    if (commaParts.length >= 3 && parseAmount(commaParts[commaParts.length - 1]) !== null) {
      return commaParts;
    }
  }

  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/);
  return line.split(/\s+/);
};

const looksLikeHeader = (line) => {
  const lower = line.toLowerCase();
  const hits = HEADER_HINTS.filter(hint => lower.includes(hint)).length;
  return hits >= 2 && !/\d{2}[/\-.]\d{2}/.test(lower);
};

/**
 * Interpreta uma linha isolada. Retorna { ok: true, entry } ou { ok: false, reason }.
 */
export const parseStatementLine = (line) => {
  const tokens = tokenize(line).map(token => token.trim()).filter(Boolean);

  if (tokens.length < 2) {
    return { ok: false, reason: 'Linha incompleta (precisa de nome, data e valor)' };
  }

  const dateIndex = tokens.findIndex(token => parseDate(token) !== null);
  if (dateIndex === -1) {
    return { ok: false, reason: 'Data não encontrada' };
  }
  const date = parseDate(tokens[dateIndex]);

  const remaining = tokens.filter((_, index) => index !== dateIndex);

  // O valor é o último token numérico — descrições costumam conter números.
  let amountIndex = -1;
  for (let index = remaining.length - 1; index >= 0; index -= 1) {
    if (parseAmount(remaining[index]) !== null) {
      amountIndex = index;
      break;
    }
  }
  if (amountIndex === -1) {
    return { ok: false, reason: 'Valor não encontrado' };
  }
  const amount = parseAmount(remaining[amountIndex]);

  const description = remaining
    .filter((_, index) => index !== amountIndex)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!description) {
    return { ok: false, reason: 'Nome/descrição vazio' };
  }
  if (amount === 0) {
    return { ok: false, reason: 'Valor zerado' };
  }

  const type = amount < 0 ? 'expense' : 'income';

  return {
    ok: true,
    entry: {
      description,
      date,
      dateText: formatDateBR(date),
      amount: Math.abs(amount),
      signedAmount: amount,
      type,
      category: guessCategory(description, type),
      billCategory: guessBillCategory(description),
    },
  };
};

/**
 * Interpreta o arquivo inteiro: entradas válidas, linhas rejeitadas e resumo.
 */
export const parseStatementText = (text) => {
  // Remove BOM que o Windows costuma colocar no início do arquivo.
  const content = String(text || '').replace(/^﻿/, '');
  const lines = content.split(/\r\n|\r|\n/);

  const entries = [];
  const invalid = [];
  let ignored = 0;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    if (COMMENT_PREFIXES.some(prefix => line.startsWith(prefix))) {
      ignored += 1;
      return;
    }
    if (looksLikeHeader(line)) {
      ignored += 1;
      return;
    }

    const result = parseStatementLine(line);
    if (result.ok) {
      entries.push({ ...result.entry, line: index + 1, raw: line });
    } else {
      invalid.push({ line: index + 1, raw: line, reason: result.reason });
    }
  });

  const income = entries.filter(entry => entry.type === 'income');
  const expense = entries.filter(entry => entry.type === 'expense');

  return {
    entries,
    invalid,
    summary: {
      total: entries.length,
      incomeCount: income.length,
      expenseCount: expense.length,
      incomeTotal: income.reduce((sum, entry) => sum + entry.amount, 0),
      expenseTotal: expense.reduce((sum, entry) => sum + entry.amount, 0),
      invalidCount: invalid.length,
      ignoredCount: ignored,
    },
  };
};

/**
 * Marca as entradas que já existem nas transações salvas.
 * A chave é descrição + valor + data, que é o que o usuário enxerga como
 * "esse lançamento já está aqui". Duplicatas dentro do próprio arquivo
 * também são marcadas, da segunda ocorrência em diante.
 */
export const markDuplicates = (entries, existingTransactions) => {
  const seen = new Set(
    (existingTransactions || []).map(
      transaction => `${String(transaction.description).trim().toLowerCase()}|${transaction.amount}|${transaction.date}`
    )
  );

  return entries.map(entry => {
    const key = `${entry.description.trim().toLowerCase()}|${entry.amount}|${entry.dateText}`;
    const isDuplicate = seen.has(key);
    seen.add(key);
    return { ...entry, isDuplicate };
  });
};

export const EXAMPLE_TXT = [
  'Salário Setembro;01/09/2026;4500,00',
  'Supermercado Extra;03/09/2026;-320,45',
  'Conta de Luz;05/09/2026;-189,90',
  'Freelance site;08/09/2026;1200,00',
].join('\n');

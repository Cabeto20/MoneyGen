/**
 * Frases de regressão: cada uma com a intenção que ela deve acionar.
 *
 * É o que segura o motor de pé. Toda vez que uma intenção nova rouba uma frase
 * de outra, é aqui que aparece — antes de virar resposta errada no aparelho.
 */
export const PHRASES = [
  // Saldo
  { text: 'quanto tenho?', intentId: 'balance_now' },
  { text: 'qual o meu saldo', intentId: 'balance_now' },
  { text: 'tenho quanto', intentId: 'balance_now' },
  { text: 'saldo atual', intentId: 'balance_now' },
  { text: 'quanto tem no Nubank', intentId: 'wallet_balance' },
  { text: 'saldo da carteira principal', intentId: 'wallet_balance' },

  // Gasto e receita por período
  { text: 'quanto gastei esse mês?', intentId: 'expense_period' },
  { text: 'quanto gastei mês passado', intentId: 'expense_period' },
  { text: 'quanto gastei essa semana', intentId: 'expense_period' },
  { text: 'quanto eu gastei em julho', intentId: 'expense_period' },
  { text: 'total de despesas do mês', intentId: 'expense_period' },
  { text: 'quanto recebi esse mês', intentId: 'income_period' },
  { text: 'quanto entrou mês passado', intentId: 'income_period' },

  // Resumo
  { text: 'como estou esse mês?', intentId: 'period_summary' },
  { text: 'me dá um resumo do mês', intentId: 'period_summary' },
  { text: 'como foi agosto', intentId: 'period_summary' },

  // Categoria
  { text: 'quanto gastei com alimentação', intentId: 'category_expense' },
  { text: 'quanto gastei com mercado em julho', intentId: 'category_expense' },
  { text: 'quanto gastei com energia', intentId: 'category_expense' },
  { text: 'quanto foi de transporte', intentId: 'category_expense' },

  // Ranking
  { text: 'com o que eu mais gasto?', intentId: 'top_categories' },
  { text: 'onde vai meu dinheiro', intentId: 'top_categories' },
  { text: 'maiores gastos do mês', intentId: 'top_categories' },

  // Comparação
  { text: 'gastei mais que mês passado?', intentId: 'compare_periods' },
  { text: 'tô gastando mais?', intentId: 'compare_periods' },
  { text: 'o que aumentou', intentId: 'fastest_growing_category' },
  { text: 'qual categoria mais subiu', intentId: 'fastest_growing_category' },
  { text: 'quanto gasto por mês em média', intentId: 'monthly_average' },

  // Contas a pagar
  { text: 'o que vence essa semana?', intentId: 'bills_due' },
  { text: 'tem conta pra pagar', intentId: 'bills_due' },
  { text: 'quais contas vencem hoje', intentId: 'bills_due' },
  { text: 'quanto ainda tenho que pagar esse mês', intentId: 'bills_pending_total' },
  { text: 'quanto eu devo', intentId: 'bills_pending_total' },
  { text: 'quanto sobra depois de pagar as contas?', intentId: 'leftover_after_bills' },
  { text: 'alguma conta mudou de valor?', intentId: 'bill_amount_changed' },

  // Orçamentos
  { text: 'estourei algum orçamento?', intentId: 'budget_exceeded' },
  { text: 'tô no vermelho?', intentId: 'budget_exceeded' },
  { text: 'quanto ainda posso gastar com lazer', intentId: 'budget_remaining' },

  // Metas
  { text: 'como estão minhas metas?', intentId: 'goal_progress' },
  { text: 'quanto falta pra meta viagem chile', intentId: 'goal_progress' },
  { text: 'quanto preciso guardar por mês pra bater a meta', intentId: 'goal_monthly_saving' },

  // Calculadoras
  { text: 'posso gastar 800 esse mês?', intentId: 'can_i_spend' },
  { text: 'dá pra comprar um celular de 2000?', intentId: 'can_i_spend' },
  { text: 'se eu parcelar 1200 em 6x como fica', intentId: 'simulate_installments' },
  { text: 'quanto posso gastar por dia até o fim do mês', intentId: 'daily_allowance' },

  // Dicas
  { text: 'me dá uma dica', intentId: 'insights' },
  { text: 'como estou indo?', intentId: 'insights' },

  // Ajuda
  { text: 'o que você sabe fazer?', intentId: 'help' },
  { text: 'me ajuda', intentId: 'help' },
  { text: 'menu', intentId: 'help' },

  // Comandos de escrita
  { text: 'gastei 50 no mercado', intentId: 'add_expense' },
  { text: 'comprei 120 de roupa', intentId: 'add_expense' },
  { text: 'paguei 30 de uber', intentId: 'add_expense' },
  { text: 'recebi 3000 de salário', intentId: 'add_income' },
  { text: 'entrou 200 de freela', intentId: 'add_income' },
  { text: 'paguei a conta de luz', intentId: 'pay_bill' },
  { text: 'quitei a internet', intentId: 'pay_bill' },
  // Valor muito acima da conta cadastrada (Energia custa 210): é despesa
  // avulsa, não quitação — é o guard de `pay_bill` que decide isso.
  { text: 'paguei 450 de luz', intentId: 'add_expense' },
  // Sem valor e sem conta reconhecível, não dá para gravar nada às cegas.
  { text: 'gastei no mercado', intentId: 'add_expense', status: 'needs-entity' },

  // Variações que o motor léxico pega sozinho. Ficam aqui para uma mudança na
  // camada semântica não ser confundida com regressão do motor de regras.
  { text: 'vai sobrar grana depois de pagar tudo', intentId: 'leftover_after_bills' },
  { text: 'estourei meu planejamento', intentId: 'budget_exceeded' },
  { text: 'o que cresceu mais', intentId: 'fastest_growing_category' },

  // Fora do alcance: tem que cair no cardápio, não numa resposta errada.
  { text: 'qual a capital da França', intentId: 'fallback' },
  { text: 'oi tudo bem', intentId: 'fallback' },
];

/**
 * Camada semântica: frases que o motor léxico NÃO resolve e que o corpus de
 * paráfrases precisa resgatar.
 *
 * Nenhuma delas está no corpus — se estivesse, o teste só provaria que o
 * embedder sabe comparar uma frase com ela mesma. São variações vizinhas, que
 * é o que o usuário realmente digita.
 */
export const SEMANTIC_PHRASES = [
  { text: 'quanta grana sobrou pra mim', intentId: 'balance_now' },
  { text: 'me diz quanto de dinheiro eu tenho', intentId: 'balance_now' },
  { text: 'como andam minhas finanças', intentId: 'period_summary' },
  { text: 'tô no sufoco esse mês', intentId: 'leftover_after_bills' },
  { text: 'o que mais pesa no meu bolso', intentId: 'top_categories' },
  { text: 'quem tá sugando minha grana', intentId: 'top_categories' },
  { text: 'tem algum boleto chegando', intentId: 'bills_due' },
  { text: 'tô pior que antes', intentId: 'compare_periods' },
  { text: 'o que você sugere pra mim', intentId: 'insights' },
  { text: 'ainda devo muita coisa', intentId: 'bills_pending_total' },
  { text: 'minha conta de luz veio mais salgada', intentId: 'bill_amount_changed' },
  { text: 'tô conseguindo guardar alguma coisa', intentId: 'goal_progress' },
  { text: 'não faço ideia do que te perguntar', intentId: 'help' },
];

/**
 * O outro lado da moeda: frase de outro assunto não pode ser resgatada.
 *
 * Responder errado com número na tela é pior que não responder — estas
 * precisam continuar caindo no cardápio de capacidades.
 */
export const OUT_OF_SCOPE_PHRASES = [
  'qual a capital da França',
  'me conta uma piada',
  'que horas são',
  'qual a previsão do tempo pra amanhã',
  'quem descobriu o Brasil',
  'como faço um bolo de cenoura',
  'oi tudo bem',
  // Perguntas de dinheiro que o app não tem como responder: não existe cotação,
  // rendimento nem imposto na base. Resgatar qualquer uma delas para uma
  // intenção de consulta responderia com o número errado, com cara de certo.
  'qual a cotação do dólar hoje',
  'quanto rende a poupança',
  'vale a pena investir em bitcoin',
  'como declaro imposto de renda',
  'me empresta dinheiro',
  'meu cartão foi clonado',
];

/**
 * Entidades que cada frase precisa extrair. Separado das intenções porque
 * extração e classificação quebram por motivos diferentes.
 */
export const ENTITY_CASES = [
  { text: 'gastei 50 no mercado', amount: 50, category: 'Alimentação', type: 'expense' },
  { text: 'recebi 3000 de salário', amount: 3000, category: 'Salário', type: 'income' },
  { text: 'paguei 30 de uber', amount: 30, category: 'Transporte', type: 'expense' },
  { text: 'comprei 120 de roupa', amount: 120, category: 'Compras', type: 'expense' },
  { text: 'se eu parcelar 1200 em 6x', amount: 1200, installments: 6 },
  { text: 'parcelar 900 em 3 vezes', amount: 900, installments: 3 },
  { text: 'gastei 2 mil', amount: 2000 },
  { text: 'gastei 1.234,56 no cartão', amount: 1234.56 },
  { text: 'paguei R$ 89,90', amount: 89.9 },
  { text: 'vence dia 10', amount: null },
  { text: 'quanto gastei em 3 meses', amount: null },
];

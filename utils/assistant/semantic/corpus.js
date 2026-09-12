/**
 * Paráfrases coloquiais por intenção.
 *
 * É o corpus que dá semântica ao motor: o embedder generaliza morfologia e erro
 * de digitação, mas quem ensina que "tô no aperto" é a mesma pergunta que
 * "quanto sobra depois das contas" é esta lista. Frase aqui é o jeito torto de
 * falar — o jeito direto já está nos `patterns` das intenções, e o casamento
 * semântico nem chega a rodar quando o motor léxico resolve.
 *
 * Só intenção de leitura. Escrita (`add_expense`, `add_income`, `pay_bill`)
 * fica de fora de propósito e é barrada em `WRITE_INTENTS`: um casamento por
 * aproximação que sugere lançar dinheiro é o pior erro possível aqui.
 */

/** Intenções que o resgate semântico nunca pode escolher, mesmo se entrarem no corpus. */
export const WRITE_INTENTS = ['add_expense', 'add_income', 'pay_bill'];

/** Turma que absorve o que não é pergunta de dinheiro. Nunca vira resposta. */
export const OUT_OF_SCOPE_INTENT = 'out_of_scope';

export const CORPUS = {
  balance_now: [
    'quanto de grana sobrou',
    'to com quanto no bolso',
    'sobrou alguma coisa pra mim',
    'cade meu dinheiro',
    'tenho grana',
    'quanta grana eu tenho guardada',
    'me diz o que eu tenho',
    'to com dinheiro',
    'ainda tenho alguma coisa',
  ],

  expense_period: [
    'gastei muito',
    'foi muito dinheiro embora',
    'quanto de grana saiu',
    'to torrando muito',
    'me diz o tamanho do estrago',
    'quanto ja foi embora esse mes',
    'saiu muita coisa da conta',
  ],

  income_period: [
    'quanto caiu pra mim',
    'quanta grana entrou',
    'meu salario ja caiu',
    'entrou dinheiro',
  ],

  period_summary: [
    'da pra comemorar',
    'tem motivo pra comemorar',
    'to indo bem',
    'me atualiza',
    'como ta minha vida financeira',
    'to no vermelho',
    'me da o retrato do mes',
    'como andam minhas financas',
    'to conseguindo me segurar',
    'me poe a par',
    'e ai como e que ta',
  ],

  top_categories: [
    'o que pesa mais no meu bolso',
    'quem ta chupando meu dinheiro',
    'meu maior peso no orcamento',
    'o que ta me sugando',
    'qual meu maior vilao',
    'no que to torrando mais',
    'o que ta comendo meu dinheiro',
    'quem ta pesando mais no bolso',
    'meu maior ralo de dinheiro',
  ],

  compare_periods: [
    'to pior do que era',
    'to melhor do que era',
    'piorei',
    'melhorei em relacao ao mes passado',
    'to gastando mais que antes',
    'to me segurando melhor que antes',
    'evolui em alguma coisa',
  ],

  fastest_growing_category: [
    'o que subiu mais',
    'o que disparou',
    'onde eu me descontrolei',
    'qual gasto cresceu',
  ],

  monthly_average: [
    'quanto eu torro por mes normalmente',
    'na media quanto sai do meu bolso',
    'quanto eu costumo gastar',
    'qual meu padrao de gasto',
    'meu normal e quanto',
    'em geral quanto sai por mes',
  ],

  bills_due: [
    'tem boleto chegando',
    'ta chegando alguma conta',
    'tem boleto pra pagar',
    'to devendo alguma coisa',
    'ta perto de vencer alguma coisa',
    'tem algo pra quitar',
    'vou ter que pagar algo agora',
    'to esquecendo de pagar alguma coisa',
  ],

  bills_pending_total: [
    'ainda falta pagar quanto',
    'quanto ainda devo esse mes',
    'quanto falta sair de conta',
    'ainda tenho quanto pra quitar',
  ],

  leftover_after_bills: [
    'to no sufoco',
    'to sufocado de conta',
    'sobra quanto pro resto do mes',
    'to apertado esse mes',
    'vai sobrar alguma coisa',
    'da pra respirar depois das contas',
    'to no aperto',
    'quanto me resta depois de pagar tudo',
    'consigo me virar ate o fim do mes',
    'da pra gastar tranquilo',
    'to duro',
  ],

  budget_exceeded: [
    'passei do limite',
    'estourei em alguma coisa',
    'furei o que eu tinha planejado',
    'to dentro do combinado',
    'respeitei meus limites',
  ],

  goal_progress: [
    'como tao meus objetivos',
    'falta muito pro que eu quero comprar',
    'to perto de conseguir',
    'meu sonho ta longe',
    'to conseguindo juntar',
  ],

  daily_allowance: [
    'quanto posso torrar por dia',
    'da pra gastar quanto por dia',
    'meu teto diario',
  ],

  bill_amount_changed: [
    'alguma conta veio mais cara',
    'minha conta aumentou',
    'pagaram mais caro esse mes',
  ],

  insights: [
    'o que voce sugere',
    'me sugere alguma coisa',
    'me ajuda a economizar',
    'o que eu faco pra melhorar',
    'tem alguma sugestao pra mim',
    'tem alguma coisa errada',
    'me da um conselho',
    'o que eu deveria olhar',
    'o que voce acha da minha situacao',
  ],

  help: [
    'nao sei o que te perguntar',
    'o que da pra fazer aqui',
    'nao sei o que perguntar',
    'o que rola aqui',
    'me ensina a usar voce',
    'pra que voce serve',
  ],
  /**
   * Conversa-fiada e pergunta de outro assunto.
   *
   * Não é uma intenção: é um pára-raios. Sem ela, "oi tudo bem" encosta em
   * `period_summary` (por causa do "bem" de "to indo bem") com nota parecida
   * com a de uma pergunta de dinheiro legítima, e nenhum limiar separa as
   * duas. Com a turma aqui, esse texto casa com o que ele é de fato e o
   * resgate devolve nada — que é o certo: cai no cardápio de capacidades.
   */
  [OUT_OF_SCOPE_INTENT]: [
    'bom dia',
    'boa noite',
    'como vai voce',
    'tudo bem com voce',
    'obrigado',
    'valeu',
    'qual o seu nome',
    'quem e voce',
    'que dia e hoje',
    'quantos habitantes tem o japao',
    'quem ganhou o jogo ontem',
    'me ensina a fazer arroz',
    'conta uma historia',
    'qual o maior pais do mundo',
    'me fala sobre o sol',
  ],
};

/** Corpus achatado em `{ intentId, text }`, que é a forma que o índice consome. */
export const CORPUS_ENTRIES = Object.keys(CORPUS).flatMap((intentId) =>
  CORPUS[intentId].map((text) => ({ intentId, text }))
);

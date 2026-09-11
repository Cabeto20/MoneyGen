import { CAPABILITY_GROUPS } from './assistant/suggestions';

/** Nome do assistente. Fonte única: header, menu lateral e apresentação. */
export const ASSISTANT_NAME = 'DominusIA Gestor Financeiro';

/** Versão curta, para onde não cabe o nome inteiro (aba, item de menu). */
export const ASSISTANT_SHORT_NAME = 'DominusIA';

const PRESENTATION = [
  `Olá! Eu sou o ${ASSISTANT_NAME}, o assistente de contas do MoneyGen.`,
  'Eu leio seus lançamentos, contas e metas direto do aparelho — sem internet, sem enviar nada para lugar nenhum — e respondo na hora. Também registro despesas e quito contas, sempre pedindo sua confirmação antes de gravar.',
  'Pode perguntar do seu jeito. Por exemplo:',
].join('\n\n');

let counter = 0;
const newMessageId = () => `welcome-${Date.now().toString(36)}-${(counter += 1)}`;

/**
 * Primeira mensagem de toda conversa nova.
 *
 * É uma mensagem de verdade, não um estado vazio: fica no histórico, é falada
 * pela voz como qualquer outra resposta e sobrevive à troca de aba. O texto é
 * fixo de propósito — como ele é persistido, uma dica dinâmica ficaria
 * congelada e desatualizada assim que os números mudassem.
 */
export const buildWelcomeMessage = () => ({
  id: newMessageId(),
  role: 'assistant',
  createdAt: new Date().toISOString(),
  blocks: [
    { type: 'text', text: PRESENTATION },
    ...CAPABILITY_GROUPS.map((group) => ({
      type: 'actions',
      title: group.title,
      options: group.items.map((item) => ({
        id: `${group.title}-${item.id}`,
        label: item.label,
        sends: item.text,
      })),
    })),
  ],
  suggestions: [],
  action: null,
  intentId: 'welcome',
  status: 'ok',
});

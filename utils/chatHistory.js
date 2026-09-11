import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Conversas com o assistente, separadas por aba.
 *
 * Fica numa chave própria, deliberadamente fora do schema v3: não tem
 * `updatedAt` de sincronização, não tem lápide e não entra no backup. Conversa
 * é estado de interface, não dado do usuário — sincronizá-la entre aparelhos
 * só criaria conflito para fundir sem nada a ganhar.
 *
 * A manipulação é toda por função pura sobre o objeto do store; só `load` e
 * `save` tocam o AsyncStorage. Assim a regra de abas é testável sem mock.
 */

const CHAT_STORE_KEY = 'chatConversations';
// Chave da versão anterior, quando existia uma conversa só.
const LEGACY_KEY = 'chatHistory';
const VERSION = 2;

export const MESSAGE_LIMIT = 50;
export const CONVERSATION_LIMIT = 10;
export const DEFAULT_TITLE = 'Nova conversa';
const TITLE_MAX_LENGTH = 28;

// Não pode usar generateId(): aquele é o gerador de id de registro do banco, e
// conversa não é registro do banco.
let counter = 0;
const newConversationId = () => `conv-${Date.now().toString(36)}-${(counter += 1)}`;

/**
 * Degrada os status que não podem sobreviver a um fechamento do app.
 *
 * `running`: se o app morreu no meio da gravação, ninguém sabe se ela foi. O
 * selo de erro é honesto e manda conferir; "executando" para sempre, não.
 *
 * `pending`: a confirmação foi calculada contra dados de horas atrás — a conta
 * pode ter sido paga em outra tela, o mês pode ter virado, o registro citado
 * pode já ser lápide. Reconfirmar às cegas gravaria algo que o usuário nunca
 * revisou naquele contexto. É `expired` e não `cancelled` porque ele não
 * cancelou nada: o selo precisa ser neutro.
 */
const degradeAction = (action) => {
  if (!action) return null;
  if (action.status === 'running') return { ...action, status: 'error' };
  if (action.status === 'pending') return { ...action, status: 'expired' };
  return action;
};

const degradeMessages = (messages) =>
  (Array.isArray(messages) ? messages : []).map((message) => ({
    ...message,
    action: degradeAction(message.action),
  }));

export const createConversation = (messages = []) => {
  const now = new Date().toISOString();
  return {
    id: newConversationId(),
    title: DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages,
  };
};

/**
 * Título da aba: a primeira coisa que o usuário perguntou.
 *
 * A mensagem de boas-vindas é do assistente, então é ignorada — se entrasse,
 * toda aba nasceria com o mesmo título e as abas ficariam indistinguíveis.
 */
export const titleFromMessages = (messages = []) => {
  const firstQuestion = messages.find((message) => message.role === 'user');
  if (!firstQuestion) return DEFAULT_TITLE;

  const text = firstQuestion.blocks
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .trim();

  if (!text) return DEFAULT_TITLE;
  if (text.length <= TITLE_MAX_LENGTH) return text;
  return `${text.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`;
};

export const emptyStore = (initialMessages = []) => {
  const conversation = createConversation(initialMessages);
  return { activeId: conversation.id, conversations: [conversation] };
};

export const activeConversation = (store) =>
  store.conversations.find((conversation) => conversation.id === store.activeId) ||
  store.conversations[0] ||
  null;

export const addConversation = (store, initialMessages = []) => {
  const conversation = createConversation(initialMessages);
  // A mais antiga sai quando estoura o limite: o histórico de abas não pode
  // crescer sem teto num storage que é relido inteiro a cada escrita.
  const conversations = [...store.conversations, conversation].slice(-CONVERSATION_LIMIT);
  return { activeId: conversation.id, conversations };
};

/**
 * Remove a aba. Nunca sobra zero: sem nenhuma conversa a tela não teria o que
 * mostrar nem onde digitar, então a última exclusão cria uma vazia no lugar.
 */
export const removeConversation = (store, id, replacementMessages = []) => {
  const conversations = store.conversations.filter((conversation) => conversation.id !== id);

  if (conversations.length === 0) return emptyStore(replacementMessages);

  const activeId =
    store.activeId === id ? conversations[conversations.length - 1].id : store.activeId;

  return { activeId, conversations };
};

export const setActiveConversation = (store, id) =>
  store.conversations.some((conversation) => conversation.id === id)
    ? { ...store, activeId: id }
    : store;

/**
 * Grava as mensagens da conversa e reavalia o título — que só se fixa depois
 * da primeira pergunta do usuário.
 */
export const replaceMessages = (store, id, messages) => {
  const pruned = messages.slice(-MESSAGE_LIMIT);

  return {
    ...store,
    conversations: store.conversations.map((conversation) =>
      conversation.id === id
        ? {
            ...conversation,
            messages: pruned,
            title: titleFromMessages(pruned),
            updatedAt: new Date().toISOString(),
          }
        : conversation
    ),
  };
};

const serialize = (store) => ({
  version: VERSION,
  activeId: store.activeId,
  conversations: store.conversations.slice(-CONVERSATION_LIMIT).map((conversation) => ({
    ...conversation,
    messages: degradeMessages(conversation.messages).slice(-MESSAGE_LIMIT),
  })),
});

/**
 * Traz a conversa única da v1 para dentro de uma aba.
 *
 * Descartar seria a linha de sempre (conversa é descartável), mas aqui custa
 * quatro linhas e evita o usuário abrir o app depois da atualização e achar
 * que perdeu o que conversou.
 */
const migrateLegacy = async () => {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    await AsyncStorage.removeItem(LEGACY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.messages)) return null;
    if (parsed.messages.length === 0) return null;

    const conversation = createConversation(degradeMessages(parsed.messages));
    return {
      activeId: conversation.id,
      conversations: [{ ...conversation, title: titleFromMessages(conversation.messages) }],
    };
  } catch (error) {
    console.error('Erro ao migrar histórico antigo do chat:', error);
    return null;
  }
};

/**
 * Carrega o store. `initialMessages` alimenta a conversa inicial quando não há
 * nada salvo — é por onde a mensagem de apresentação entra.
 */
export const loadChatStore = async (initialMessages = []) => {
  try {
    const raw = await AsyncStorage.getItem(CHAT_STORE_KEY);

    if (!raw) {
      const migrated = await migrateLegacy();
      return migrated || emptyStore(initialMessages);
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.conversations)) {
      return emptyStore(initialMessages);
    }

    const conversations = parsed.conversations
      .filter((conversation) => conversation && conversation.id)
      .map((conversation) => ({
        ...conversation,
        title: conversation.title || DEFAULT_TITLE,
        messages: degradeMessages(conversation.messages),
      }));

    if (conversations.length === 0) return emptyStore(initialMessages);

    const activeId = conversations.some((conversation) => conversation.id === parsed.activeId)
      ? parsed.activeId
      : conversations[conversations.length - 1].id;

    return { activeId, conversations };
  } catch (error) {
    console.error('Erro ao carregar conversas do chat:', error);
    return emptyStore(initialMessages);
  }
};

export const saveChatStore = async (store) => {
  try {
    await AsyncStorage.setItem(CHAT_STORE_KEY, JSON.stringify(serialize(store)));
  } catch (error) {
    console.error('Erro ao salvar conversas do chat:', error);
  }
};

/** Apaga todas as conversas. Usado pelo "Limpar Dados" em Ajustes. */
export const clearChatHistory = async () => {
  try {
    await AsyncStorage.multiRemove([CHAT_STORE_KEY, LEGACY_KEY]);
  } catch (error) {
    console.error('Erro ao limpar conversas do chat:', error);
  }
};

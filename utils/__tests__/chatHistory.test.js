import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadChatStore,
  saveChatStore,
  clearChatHistory,
  emptyStore,
  activeConversation,
  addConversation,
  removeConversation,
  setActiveConversation,
  replaceMessages,
  titleFromMessages,
  MESSAGE_LIMIT,
  CONVERSATION_LIMIT,
  DEFAULT_TITLE,
} from '../chatHistory';

const userSays = (text) => ({
  id: `u-${text}`,
  role: 'user',
  createdAt: '2026-09-10T12:00:00.000Z',
  blocks: [{ type: 'text', text }],
  suggestions: [],
  action: null,
});

const assistantSays = (id, action = null) => ({
  id,
  role: 'assistant',
  createdAt: '2026-09-10T12:00:00.000Z',
  blocks: [{ type: 'text', text: `resposta ${id}` }],
  suggestions: [],
  action,
});

const welcome = () => assistantSays('boas-vindas');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('abas de conversa (funções puras)', () => {
  it('começa com uma conversa ativa contendo a mensagem inicial', () => {
    const store = emptyStore([welcome()]);

    expect(store.conversations).toHaveLength(1);
    expect(activeConversation(store).messages).toHaveLength(1);
    expect(store.activeId).toBe(store.conversations[0].id);
  });

  it('cria uma aba nova e já a deixa ativa', () => {
    const store = addConversation(emptyStore([welcome()]), [welcome()]);

    expect(store.conversations).toHaveLength(2);
    expect(store.activeId).toBe(store.conversations[1].id);
  });

  it('troca a aba ativa', () => {
    const store = addConversation(emptyStore(), []);
    const first = store.conversations[0].id;

    expect(setActiveConversation(store, first).activeId).toBe(first);
  });

  it('ignora troca para uma aba que não existe', () => {
    const store = emptyStore();
    expect(setActiveConversation(store, 'nao-existe')).toBe(store);
  });

  it('exclui uma aba e ativa outra quando a excluída era a ativa', () => {
    const store = addConversation(emptyStore(), []);
    const removed = removeConversation(store, store.activeId);

    expect(removed.conversations).toHaveLength(1);
    expect(removed.activeId).toBe(removed.conversations[0].id);
  });

  // Sem nenhuma conversa a tela não teria o que mostrar nem onde digitar.
  it('excluir a última cria uma vazia no lugar', () => {
    const store = emptyStore([welcome()]);
    const removed = removeConversation(store, store.activeId, [welcome()]);

    expect(removed.conversations).toHaveLength(1);
    expect(removed.conversations[0].id).not.toBe(store.conversations[0].id);
    expect(removed.conversations[0].messages).toHaveLength(1);
  });

  it(`não passa de ${CONVERSATION_LIMIT} abas, descartando a mais antiga`, () => {
    let store = emptyStore();
    const firstId = store.conversations[0].id;

    for (let i = 0; i < CONVERSATION_LIMIT + 3; i += 1) {
      store = addConversation(store, []);
    }

    expect(store.conversations).toHaveLength(CONVERSATION_LIMIT);
    expect(store.conversations.some((c) => c.id === firstId)).toBe(false);
  });

  it('poda as mensagens da conversa no limite', () => {
    const store = emptyStore();
    const many = Array.from({ length: MESSAGE_LIMIT + 20 }, (_, i) => assistantSays(String(i)));
    const updated = replaceMessages(store, store.activeId, many);

    expect(activeConversation(updated).messages).toHaveLength(MESSAGE_LIMIT);
  });
});

describe('título da aba', () => {
  it('usa a primeira pergunta do usuário', () => {
    expect(titleFromMessages([welcome(), userSays('quanto gastei esse mês')])).toBe(
      'quanto gastei esse mês'
    );
  });

  // Se a apresentação entrasse, toda aba nasceria com o mesmo título.
  it('ignora a mensagem de boas-vindas do assistente', () => {
    expect(titleFromMessages([welcome()])).toBe(DEFAULT_TITLE);
  });

  it('trunca pergunta longa', () => {
    const title = titleFromMessages([
      userSays('quanto eu gastei com alimentação e transporte no mês passado'),
    ]);

    expect(title.length).toBeLessThanOrEqual(29);
    expect(title.endsWith('…')).toBe(true);
  });

  it('o título se fixa sozinho ao gravar as mensagens', () => {
    const store = emptyStore([welcome()]);
    const updated = replaceMessages(store, store.activeId, [welcome(), userSays('meu saldo')]);

    expect(activeConversation(updated).title).toBe('meu saldo');
  });
});

describe('persistência', () => {
  it('grava e lê de volta preservando a aba ativa', async () => {
    let store = addConversation(emptyStore(), []);
    store = replaceMessages(store, store.activeId, [userSays('oi')]);
    await saveChatStore(store);

    const loaded = await loadChatStore();

    expect(loaded.conversations).toHaveLength(2);
    expect(loaded.activeId).toBe(store.activeId);
    expect(activeConversation(loaded).title).toBe('oi');
  });

  it('sem nada salvo, devolve uma conversa com a mensagem inicial', async () => {
    const loaded = await loadChatStore([welcome()]);

    expect(loaded.conversations).toHaveLength(1);
    expect(activeConversation(loaded).messages).toHaveLength(1);
  });

  it('descarta store de versão desconhecida em vez de quebrar', async () => {
    await AsyncStorage.setItem(
      'chatConversations',
      JSON.stringify({ version: 99, conversations: [{ id: 'x', messages: [] }] })
    );

    const loaded = await loadChatStore([welcome()]);
    expect(loaded.conversations[0].id).not.toBe('x');
  });

  it('não quebra com JSON corrompido', async () => {
    await AsyncStorage.setItem('chatConversations', 'isto não é json');

    const loaded = await loadChatStore([welcome()]);
    expect(loaded.conversations).toHaveLength(1);
  });

  it('cai numa aba válida quando o activeId salvo não existe mais', async () => {
    await AsyncStorage.setItem(
      'chatConversations',
      JSON.stringify({
        version: 2,
        activeId: 'sumiu',
        conversations: [{ id: 'c1', title: 'A', messages: [] }],
      })
    );

    const loaded = await loadChatStore();
    expect(loaded.activeId).toBe('c1');
  });

  it('limpa tudo', async () => {
    await saveChatStore(emptyStore([welcome()]));
    await clearChatHistory();

    expect(await AsyncStorage.getItem('chatConversations')).toBeNull();
  });
});

describe('migração da conversa única da v1', () => {
  it('traz o histórico antigo para dentro de uma aba', async () => {
    await AsyncStorage.setItem(
      'chatHistory',
      JSON.stringify({ version: 1, messages: [userSays('pergunta antiga'), assistantSays('a1')] })
    );

    const loaded = await loadChatStore([welcome()]);

    expect(loaded.conversations).toHaveLength(1);
    expect(activeConversation(loaded).messages).toHaveLength(2);
    expect(activeConversation(loaded).title).toBe('pergunta antiga');
    // A chave antiga não pode sobrar, senão a migração roda de novo.
    expect(await AsyncStorage.getItem('chatHistory')).toBeNull();
  });

  it('histórico antigo vazio não vira aba sem apresentação', async () => {
    await AsyncStorage.setItem('chatHistory', JSON.stringify({ version: 1, messages: [] }));

    const loaded = await loadChatStore([welcome()]);
    expect(activeConversation(loaded).messages).toHaveLength(1);
  });
});

describe('degradação de ações ao fechar o app', () => {
  const storeWithAction = (status) => {
    const store = emptyStore();
    return replaceMessages(store, store.activeId, [assistantSays('m1', { type: 'addExpense', status })]);
  };

  // Confirmação calculada contra dados de horas atrás não pode ser executada
  // às cegas: a conta pode ter sido paga por outra tela nesse meio-tempo.
  it('transforma pendente em expirada', async () => {
    await saveChatStore(storeWithAction('pending'));
    const loaded = await loadChatStore();

    expect(activeConversation(loaded).messages[0].action.status).toBe('expired');
  });

  // Se o app morreu no meio da gravação, ninguém sabe se ela foi.
  it('transforma executando em erro', async () => {
    await saveChatStore(storeWithAction('running'));
    const loaded = await loadChatStore();

    expect(activeConversation(loaded).messages[0].action.status).toBe('error');
  });

  it('preserva os status finais', async () => {
    await saveChatStore(storeWithAction('done'));
    const loaded = await loadChatStore();

    expect(activeConversation(loaded).messages[0].action.status).toBe('done');
  });
});

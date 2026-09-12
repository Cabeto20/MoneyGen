import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../utils/responsive';
import { askAssistant, runPendingAction, warmSemanticIndex, hydrateMemory } from '../utils/assistant';
import {
  loadChatStore,
  saveChatStore,
  activeConversation,
  addConversation,
  removeConversation,
  setActiveConversation,
  replaceMessages,
} from '../utils/chatHistory';
import { buildWelcomeMessage } from '../utils/chatWelcome';
import {
  getVoiceEnabled,
  setVoiceEnabled as saveVoiceEnabled,
  speak,
  stopSpeaking,
  prepareVoice,
} from '../utils/speech';
import ChatBubble, { createBubbleStyles, plainText } from './ChatBubble';
import ChatTabs, { createTabStyles } from './ChatTabs';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

// O id da mensagem não pode usar generateId(): aquele é o gerador de id de
// registro do banco, e conversa não é registro do banco.
let messageCounter = 0;
const newMessageId = () => `msg-${Date.now().toString(36)}-${(messageCounter += 1)}`;

const userMessage = (text) => ({
  id: newMessageId(),
  role: 'user',
  createdAt: new Date().toISOString(),
  blocks: [{ type: 'text', text }],
  suggestions: [],
  action: null,
});

const assistantMessage = (result) => ({
  id: newMessageId(),
  role: 'assistant',
  createdAt: new Date().toISOString(),
  blocks: result.blocks,
  suggestions: result.suggestions || [],
  action: result.action ? { ...result.action, status: 'pending' } : null,
  intentId: result.intentId,
  status: result.status,
});

const assistantText = (text) => ({
  id: newMessageId(),
  role: 'assistant',
  createdAt: new Date().toISOString(),
  blocks: [{ type: 'text', text }],
  suggestions: [],
  action: null,
});


/**
 * Frase que o assistente não entendeu, dado o cardápio em que o usuário tocou.
 *
 * É o sinal de ensino da camada 1, e ele é explícito de propósito: só vale o
 * toque num chip de uma bolha de `fallback`, que é o único momento em que a
 * escolha do usuário significa "era isto que eu queria dizer". Deduzir a lição
 * de qualquer pergunta que viesse depois de um fallback ensinaria besteira toda
 * vez que ele simplesmente mudasse de assunto.
 */
const unresolvedBefore = (messages, message) => {
  if (!message || message.status !== 'fallback') return null;

  const index = messages.findIndex((item) => item.id === message.id);
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].blocks?.[0]?.text || null;
  }
  return null;
};

/** Conversa dona de uma mensagem — ela pode não ser mais a aba ativa. */
const conversationOf = (store, messageId) =>
  store.conversations.find((conversation) =>
    conversation.messages.some((message) => message.id === messageId)
  );

const ChatScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const insets = useSafeAreaInsets();

  const [store, setStore] = useState(() => ({ activeId: null, conversations: [] }));
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  // Sob edge-to-edge (android/gradle.properties) o Android não redimensiona a
  // janela ao abrir o teclado — o `adjustResize` do manifesto vira decorativo,
  // o teclado chega como inset. Sem medir sua altura manualmente, o composer
  // fica embaixo da tela e o teclado o cobre por cima.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Espelho síncrono: todo handler que grava precisa do store NOVO para
  // persistir. Ler `store` dentro do handler devolve o valor da renderização
  // anterior e salvaria sem a última mensagem.
  const storeRef = useRef(store);
  // Ref e não estado: dois toques rápidos no Confirmar entram aqui antes do
  // re-render, e addTransaction não é idempotente — gravaria duas vezes.
  const runningRef = useRef(new Set());
  const voiceRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const initialQuestionRef = useRef(false);
  const pendingRef = useRef(null);
  const listRef = useRef(null);

  const styles = createStyles(theme, r);
  const bubbleStyles = createBubbleStyles(theme, r);
  const tabStyles = createTabStyles(theme, r);

  const applyStore = useCallback((next) => {
    storeRef.current = next;
    setStore(next);
    saveChatStore(next);
  }, []);

  const appendTo = useCallback(
    (conversationId, ...added) => {
      const current = storeRef.current;
      const conversation = current.conversations.find((item) => item.id === conversationId);
      if (!conversation) return;

      applyStore(
        replaceMessages(current, conversationId, [...conversation.messages, ...added])
      );
    },
    [applyStore]
  );

  const append = useCallback(
    (...added) => appendTo(storeRef.current.activeId, ...added),
    [appendTo]
  );

  const speakMessage = useCallback(
    (message) => {
      // Tocar de novo na mesma mensagem para: é o comportamento esperado de um
      // botão que virou "Parar".
      if (speakingId === message.id) {
        stopSpeaking();
        setSpeakingId(null);
        return;
      }

      setSpeakingId(message.id);
      speak(plainText(message.blocks), {
        onDone: () => setSpeakingId(null),
        onStopped: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    },
    [speakingId]
  );

  /**
   * Fala a resposta recém-chegada, se a voz estiver ligada.
   *
   * É chamada no ponto em que a mensagem nasce, e não reagindo ao estado: um
   * efeito sobre a lista falaria tudo de novo ao recarregar o histórico ou ao
   * trocar de aba.
   */
  const announce = useCallback((message) => {
    if (!voiceRef.current) return;

    setSpeakingId(message.id);
    speak(plainText(message.blocks), {
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, []);

  const send = useCallback(
    async (rawText, fromMessage = null) => {
      const text = String(rawText || '').trim();
      if (!text) return;

      // Lida antes de anexar a mensagem nova, senão o índice da bolha de origem
      // muda debaixo da busca.
      const active = activeConversation(storeRef.current);
      const teachFor = unresolvedBefore(active?.messages || [], fromMessage);

      setDraft('');
      append(userMessage(text));
      setThinking(true);

      try {
        const result = await askAssistant(text, { pending: pendingRef.current, teachFor });
        // A memória de "Quanto foi?" vale um turno só.
        pendingRef.current = result.pending || null;

        const message = assistantMessage(result);
        append(message);
        announce(message);
      } finally {
        setThinking(false);
      }
    },
    [append, announce]
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      // Memória primeiro, índice depois: as frases aprendidas entram no índice,
      // então aquecer antes de carregá-las só obrigaria a remontar. Com o
      // embedder léxico o custo é desprezível, mas é aqui que um modelo local
      // pagaria o carregamento — e ele não pode cair em cima da primeira
      // pergunta do usuário.
      hydrateMemory().then(warmSemanticIndex);

      // Descobre a voz masculina antes da primeira resposta: consultar o TTS é
      // assíncrono e `speak` não espera por isso.
      prepareVoice();

      (async () => {
        // As conversas são estado de interface, não banco: recarregá-las a cada
        // foco sobrescreveria o que o usuário acabou de conversar.
        if (!historyLoadedRef.current) {
          const [saved, voice] = await Promise.all([
            loadChatStore([buildWelcomeMessage()]),
            getVoiceEnabled(),
          ]);
          if (!alive) return;

          historyLoadedRef.current = true;
          storeRef.current = saved;
          setStore(saved);
          voiceRef.current = voice;
          setVoiceOn(voice);
        }

        // A pergunta vinda do card da Home vale uma vez; sem limpar o
        // parâmetro, ela seria reenviada toda vez que a tela ganhasse foco.
        const question = route?.params?.initialQuestion;
        if (question && !initialQuestionRef.current) {
          initialQuestionRef.current = true;
          navigation.setParams({ initialQuestion: undefined });
          send(question);
        }
      })();

      return () => {
        alive = false;
        // Sair da tela tem que calar a voz — senão o assistente continua
        // falando por cima da tela seguinte.
        stopSpeaking();
        setSpeakingId(null);
      };
    }, [route?.params?.initialQuestion, navigation, send])
  );

  // `freezeOnBlur: true` (App.js) congela a tela sem desmontar — o listener
  // precisa de cleanup no retorno do useFocusEffect, senão ele se acumula a
  // cada vez que o usuário sai e volta para o chat.
  useFocusEffect(
    useCallback(() => {
      const showEvent = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
      const hideEvent = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';

      const show = Keyboard.addListener(showEvent, (event) => {
        setKeyboardHeight(event.endCoordinates?.height || 0);
      });
      const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

      return () => {
        show.remove();
        hide.remove();
      };
    }, [])
  );

  const updateAction = useCallback(
    (messageId, changes) => {
      const current = storeRef.current;

      // Percorre todas as conversas, não só a ativa: a gravação é assíncrona e
      // o usuário pode ter trocado de aba no meio dela.
      applyStore({
        ...current,
        conversations: current.conversations.map((conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === messageId
              ? { ...message, action: { ...message.action, ...changes } }
              : message
          ),
        })),
      });
    },
    [applyStore]
  );

  const confirmAction = useCallback(
    async (messageId) => {
      if (runningRef.current.has(messageId)) return;

      const owner = conversationOf(storeRef.current, messageId);
      const target = owner?.messages.find((message) => message.id === messageId);
      // Segunda trava, contra o replay de um histórico recarregado.
      if (target?.action?.status !== 'pending') return;

      runningRef.current.add(messageId);
      updateAction(messageId, { status: 'running' });

      try {
        const result = await runPendingAction(target.action);
        updateAction(messageId, {
          status: result.ok ? 'done' : result.expired ? 'expired' : 'error',
        });

        const message = assistantText(result.text);
        appendTo(owner.id, message);
        announce(message);
      } catch (error) {
        console.error('Erro ao confirmar ação do chat:', error);
        updateAction(messageId, { status: 'error' });
        appendTo(owner.id, assistantText('Não consegui gravar. Tente pela tela de lançamentos.'));
      } finally {
        runningRef.current.delete(messageId);
      }
    },
    [updateAction, appendTo, announce]
  );

  const cancelAction = useCallback(
    (messageId) => {
      const owner = conversationOf(storeRef.current, messageId);
      const target = owner?.messages.find((message) => message.id === messageId);
      if (target?.action?.status !== 'pending') return;

      updateAction(messageId, { status: 'cancelled' });
      appendTo(owner.id, assistantText('Tudo bem, não registrei nada.'));
    },
    [updateAction, appendTo]
  );

  const selectConversation = useCallback(
    (id) => {
      stopSpeaking();
      setSpeakingId(null);
      // A memória de "Quanto foi?" pertence ao fio da conversa anterior.
      pendingRef.current = null;
      applyStore(setActiveConversation(storeRef.current, id));
    },
    [applyStore]
  );

  const createConversationTab = useCallback(() => {
    stopSpeaking();
    setSpeakingId(null);
    pendingRef.current = null;
    applyStore(addConversation(storeRef.current, [buildWelcomeMessage()]));
  }, [applyStore]);

  const confirmDeleteConversation = useCallback(
    (id) => {
      const conversation = storeRef.current.conversations.find((item) => item.id === id);
      if (!conversation) return;

      Alert.alert(
        'Excluir conversa',
        `"${conversation.title}" será apagada. Seus lançamentos, contas e metas continuam como estão.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => {
              stopSpeaking();
              setSpeakingId(null);
              pendingRef.current = null;
              applyStore(removeConversation(storeRef.current, id, [buildWelcomeMessage()]));
            },
          },
        ]
      );
    },
    [applyStore]
  );

  const toggleVoice = useCallback(async () => {
    const next = !voiceRef.current;
    voiceRef.current = next;
    setVoiceOn(next);

    if (!next) {
      stopSpeaking();
      setSpeakingId(null);
    }

    await saveVoiceEnabled(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            testID="chat-voice-toggle"
            onPress={toggleVoice}
            hitSlop={HIT_SLOP}
            accessibilityRole="switch"
            accessibilityState={{ checked: voiceOn }}
            accessibilityLabel={voiceOn ? 'Desligar a voz do assistente' : 'Ligar a voz do assistente'}
          >
            <Ionicons
              name={voiceOn ? 'volume-high' : 'volume-mute-outline'}
              size={r.font(21)}
              color={voiceOn ? theme.primary : theme.text}
            />
          </TouchableOpacity>
        ),
      });

      return () => navigation.setOptions({ headerRight: undefined });
    }, [navigation, toggleVoice, voiceOn, r, theme])
  );

  const active = activeConversation(store);
  const messages = active?.messages || [];

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  const renderItem = useCallback(
    ({ item, index }) => {
      const previous = messages[index - 1];
      return (
        <ChatBubble
          message={item}
          theme={theme}
          r={r}
          styles={bubbleStyles}
          showAvatar={!previous || previous.role !== 'assistant'}
          announce={item.id === lastAssistantId}
          speaking={speakingId === item.id}
          onSuggestion={(text) => send(text, item)}
          onConfirm={() => confirmAction(item.id)}
          onCancel={() => cancelAction(item.id)}
          onSpeak={speakMessage}
        />
      );
    },
    [
      messages,
      theme,
      r,
      bubbleStyles,
      lastAssistantId,
      speakingId,
      send,
      confirmAction,
      cancelAction,
      speakMessage,
    ]
  );

  const lastSuggestions = messages.length > 0 ? messages[messages.length - 1].suggestions : [];
  const canSend = draft.trim().length > 0 && !thinking;

  return (
    <View style={styles.container}>
      <ChatTabs
        conversations={store.conversations}
        activeId={store.activeId}
        theme={theme}
        r={r}
        styles={tabStyles}
        onSelect={selectConversation}
        onCreate={createConversationTab}
        onDelete={confirmDeleteConversation}
      />

      <FlatList
        ref={listRef}
        style={styles.list}
        // Trocar de aba precisa remontar a lista do zero, senão o scroll da
        // conversa anterior vaza para a nova.
        key={store.activeId}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        // Sem isso, o primeiro toque num chip com o teclado aberto só fecha o
        // teclado — o usuário precisa tocar duas vezes.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={10}
      />

      {lastSuggestions.length > 0 && (
        <View style={styles.suggestionBar}>
          {lastSuggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.suggestionChip}
              onPress={() => send(suggestion.text)}
              accessibilityRole="button"
              accessibilityLabel={`Perguntar: ${suggestion.label}`}
            >
              <Text style={styles.suggestionText}>{suggestion.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fluxo normal, nunca position:absolute — com a janela redimensionando
          pelo teclado, uma barra absoluta fica presa atrás dele.

          O padding usa Math.max, não soma: com o teclado fechado o espaço vem
          da safe area (barra de gestos); com ele aberto, keyboardHeight já
          inclui esse espaço, e somar os dois deixaria uma faixa em branco do
          dobro do tamanho entre o composer e o teclado. */}
      <View
        testID="chat-composer"
        style={[
          styles.composer,
          { paddingBottom: Math.max(keyboardHeight, insets.bottom + r.space(8)) },
        ]}
      >
        <TextInput
          testID="chat-input"
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Pergunte sobre suas contas..."
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={200}
          accessibilityLabel="Mensagem para o assistente"
        />
        <TouchableOpacity
          testID="chat-send"
          style={[styles.sendButton, !canSend && styles.sendButtonOff]}
          onPress={() => send(draft)}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          accessibilityState={{ disabled: !canSend }}
        >
          <Ionicons name="arrow-up" size={r.font(19)} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme, r) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { flex: 1 },
    listContent: {
      flexGrow: 1,
      paddingHorizontal: r.space(14),
      paddingTop: r.space(14),
      paddingBottom: r.space(6),
    },

    suggestionBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: r.space(7),
      paddingHorizontal: r.space(14),
      paddingBottom: r.space(8),
    },
    suggestionChip: {
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 12,
      paddingVertical: r.space(9),
      paddingHorizontal: r.space(12),
    },
    suggestionText: { color: theme.primary, fontSize: r.font(13), fontWeight: '600' },

    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: r.space(8),
      paddingHorizontal: r.space(14),
      paddingTop: r.space(8),
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.surface,
    },
    input: {
      flex: 1,
      color: theme.text,
      fontSize: r.font(15),
      backgroundColor: theme.card,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: r.space(13),
      paddingVertical: r.space(11),
      maxHeight: r.font(15) * 6,
    },
    sendButton: {
      width: r.space(44),
      height: r.space(44),
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonOff: { opacity: 0.4 },
  });

export default ChatScreen;

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Barra de abas de conversa.
 *
 * Molde dos chips horizontais do AccountPicker, que é o padrão de seleção
 * horizontal já usado no app. Toque troca de aba; toque longo abre a exclusão.
 */
const ChatTabs = ({ conversations, activeId, theme, r, styles, onSelect, onCreate, onDelete }) => {
  const scrollRef = useRef(null);
  const activeIndex = conversations.findIndex((conversation) => conversation.id === activeId);

  // Criar uma aba nova a coloca no fim da lista, fora da área visível quando
  // já há várias. Sem esse scroll, o usuário toca em "+" e nada parece mudar.
  useEffect(() => {
    if (activeIndex === conversations.length - 1) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [activeIndex, conversations.length]);

  return (
    <View style={styles.tabBar}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        keyboardShouldPersistTaps="handled"
      >
        {conversations.map((conversation) => {
          const active = conversation.id === activeId;

          return (
            <TouchableOpacity
              key={conversation.id}
              testID={`chat-tab-${conversation.id}`}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => onSelect(conversation.id)}
              onLongPress={() => onDelete(conversation.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Conversa ${conversation.title}`}
              accessibilityHint="Toque longo para excluir"
            >
              <Text
                style={[styles.tabText, active && styles.tabTextActive]}
                numberOfLines={1}
              >
                {conversation.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        testID="chat-new-tab"
        style={styles.tabAdd}
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="Nova conversa"
      >
        <Ionicons name="add" size={r.font(20)} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
};

export const createTabStyles = (theme, r) =>
  StyleSheet.create({
    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    tabRow: {
      gap: r.space(6),
      paddingHorizontal: r.space(10),
      paddingVertical: r.space(8),
      alignItems: 'center',
    },
    tab: {
      maxWidth: r.space(150),
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: r.space(7),
      paddingHorizontal: r.space(12),
    },
    tabActive: {
      backgroundColor: theme.primaryLight,
      borderColor: theme.primary,
    },
    tabText: {
      color: theme.textSecondary,
      fontSize: r.font(12),
      fontWeight: '600',
    },
    tabTextActive: { color: theme.primary },
    tabAdd: {
      width: r.space(40),
      height: r.space(40),
      alignItems: 'center',
      justifyContent: 'center',
      borderLeftWidth: 1,
      borderLeftColor: theme.border,
    },
  });

export default ChatTabs;

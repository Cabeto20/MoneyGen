import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatCurrency';
import { getCategoryColor, getCategoryIconName } from '../utils/categories';

const SPEAK_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

/** Cor de destaque e fundo de cada tom, sempre vindas do tema. */
const toneColors = (theme, tone) => {
  switch (tone) {
    case 'positivo':
      return { color: theme.success, background: theme.successLight };
    case 'negativo':
      return { color: theme.error, background: theme.errorLight };
    case 'alerta':
      return { color: theme.warning, background: theme.warningLight };
    default:
      return { color: theme.text, background: theme.inputBg };
  }
};

const SEAL = {
  done: { icon: 'checkmark-circle', label: 'Registrado', tone: 'positivo' },
  cancelled: { icon: 'close-circle', label: 'Cancelado', tone: 'neutro' },
  expired: { icon: 'time-outline', label: 'Confirmação expirada — peça de novo', tone: 'neutro' },
  error: { icon: 'alert-circle', label: 'Não deu certo', tone: 'negativo' },
};

/** Texto corrido de uma mensagem, para o leitor de tela ler a bolha inteira. */
export const plainText = (blocks = []) =>
  blocks
    .map((block) => {
      if (block.type === 'text') return block.text;
      if (block.type === 'value') return `${block.label}: ${formatCurrency(block.value)}`;
      if (block.type === 'list') {
        return block.items
          .map((item) => [item.title, item.subtitle, item.value != null ? formatCurrency(item.value) : null].filter(Boolean).join(', '))
          .join('. ');
      }
      if (block.type === 'confirmation') return block.question;
      return '';
    })
    .filter(Boolean)
    .join('. ');

const ValueBlock = ({ block, theme, styles }) => {
  const { color, background } = toneColors(theme, block.tone);
  return (
    <View style={[styles.valueCard, { backgroundColor: background }]}>
      <Text style={styles.valueLabel}>{block.label}</Text>
      <Text selectable style={[styles.valueAmount, { color }]}>
        {formatCurrency(block.value)}
      </Text>
    </View>
  );
};

const ListBlock = ({ block, theme, r, styles }) => (
  <View style={styles.list}>
    {block.items.map((item) => {
      const color = item.category ? getCategoryColor(item.category) : theme.textSecondary;
      const tone = toneColors(theme, item.tone);

      return (
        <View key={item.id} style={styles.listRow}>
          {item.category ? (
            <View style={[styles.listIcon, { backgroundColor: `${color}20` }]}>
              <Ionicons name={getCategoryIconName(item.category)} size={r.font(15)} color={color} />
            </View>
          ) : (
            <View style={[styles.listIcon, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="ellipse" size={r.font(9)} color={theme.primary} />
            </View>
          )}

          <View style={styles.listInfo}>
            <Text style={styles.listTitle}>{item.title}</Text>
            {!!item.subtitle && <Text style={styles.listSubtitle}>{item.subtitle}</Text>}
          </View>

          {item.value != null && (
            <Text style={[styles.listValue, { color: tone.color }]}>
              {formatCurrency(item.value)}
            </Text>
          )}
        </View>
      );
    })}

    {block.total > block.items.length && (
      <Text style={styles.listMore}>e mais {block.total - block.items.length}…</Text>
    )}
  </View>
);

const ActionsBlock = ({ block, styles, onSuggestion }) => (
  <View style={styles.actionsBlock}>
    {!!block.title && <Text style={styles.actionsTitle}>{block.title}</Text>}
    <View style={styles.chipRow}>
      {block.options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={styles.chip}
          onPress={() => onSuggestion(option.sends)}
          accessibilityRole="button"
          accessibilityLabel={`Perguntar: ${option.label}`}
        >
          <Text style={styles.chipText}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

/**
 * Confirmação de gravação. Quando a ação sai de `pending`, os botões deixam a
 * árvore e viram selo — não pode existir caminho para reconfirmar, nem por
 * duplo toque nem pelo leitor de tela.
 */
const ConfirmationBlock = ({ block, action, theme, r, styles, onConfirm, onCancel }) => {
  const status = action?.status || 'pending';

  if (status !== 'pending' && status !== 'running') {
    const seal = SEAL[status] || SEAL.error;
    const { color, background } = toneColors(theme, seal.tone);

    return (
      <View style={[styles.seal, { backgroundColor: background }]}>
        <Ionicons name={seal.icon} size={r.font(16)} color={color} />
        <Text style={[styles.sealText, { color }]}>{seal.label}</Text>
      </View>
    );
  }

  const running = status === 'running';

  return (
    <View style={styles.confirmRow}>
      <TouchableOpacity
        testID="chat-confirm"
        style={[styles.confirmButton, running && styles.buttonDisabled]}
        onPress={onConfirm}
        disabled={running}
        accessibilityRole="button"
        accessibilityLabel={`Confirmar: ${block.question}`}
        accessibilityState={{ disabled: running }}
      >
        {running ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark" size={r.font(17)} color="#fff" />
            <Text style={styles.confirmText}>Confirmar</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID="chat-cancel"
        style={[styles.cancelButton, running && styles.buttonDisabled]}
        onPress={onCancel}
        disabled={running}
        accessibilityRole="button"
        accessibilityLabel="Cancelar, não registrar"
        accessibilityState={{ disabled: running }}
      >
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
};

const ChatBubble = ({
  message,
  theme,
  r,
  styles,
  showAvatar,
  announce,
  speaking,
  onSuggestion,
  onConfirm,
  onCancel,
  onSpeak,
}) => {
  const isUser = message.role === 'user';
  const label = `${isUser ? 'Você' : 'Assistente'}: ${plainText(message.blocks)}`;

  const renderBlock = (block, index) => {
    switch (block.type) {
      case 'text':
        return (
          <Text key={index} selectable style={isUser ? styles.userText : styles.assistantText}>
            {block.text}
          </Text>
        );
      case 'value':
        return <ValueBlock key={index} block={block} theme={theme} styles={styles} />;
      case 'list':
        return <ListBlock key={index} block={block} theme={theme} r={r} styles={styles} />;
      case 'actions':
        return <ActionsBlock key={index} block={block} styles={styles} onSuggestion={onSuggestion} />;
      case 'confirmation':
        return (
          <ConfirmationBlock
            key={index}
            block={block}
            action={message.action}
            theme={theme}
            r={r}
            styles={styles}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        );
      // Histórico gravado por uma versão futura não pode derrubar a tela.
      default:
        return null;
    }
  };

  return (
    <View style={styles.messageRow}>
      {!isUser &&
        (showAvatar ? (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={r.font(16)} color={theme.primary} />
          </View>
        ) : (
          <View style={styles.avatarSpacer} />
        ))}

      <View
        accessible
        accessibilityLabel={label}
        accessibilityLiveRegion={announce ? 'polite' : 'none'}
        style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
      >
        {message.blocks.map(renderBlock)}

        {/* Ouvir de novo. Só na resposta do assistente: reler em voz alta o
            que o próprio usuário digitou não serve para nada. */}
        {!isUser && !!onSpeak && (
          <TouchableOpacity
            testID={`chat-speak-${message.id}`}
            style={styles.speakButton}
            onPress={() => onSpeak(message)}
            hitSlop={SPEAK_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={speaking ? 'Parar de ouvir' : 'Ouvir esta resposta'}
          >
            <Ionicons
              name={speaking ? 'stop-circle-outline' : 'volume-medium-outline'}
              size={r.font(16)}
              color={theme.textSecondary}
            />
            <Text style={styles.speakText}>{speaking ? 'Parar' : 'Ouvir'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const createBubbleStyles = (theme, r) =>
  StyleSheet.create({
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: r.space(10),
      gap: r.space(8),
    },
    avatar: {
      width: r.font(32),
      height: r.font(32),
      borderRadius: r.font(16),
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSpacer: { width: r.font(32) },
    bubble: {
      borderRadius: 16,
      paddingVertical: r.space(10),
      paddingHorizontal: r.space(13),
      gap: r.space(8),
    },
    userBubble: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 4,
      maxWidth: r.isTablet ? '70%' : '82%',
      marginLeft: 'auto',
    },
    // A borda não é enfeite: no tema claro `card` e `surface` são ambos
    // brancos, e sem ela a bolha some no fundo.
    assistantBubble: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderBottomLeftRadius: 4,
      maxWidth: r.isTablet ? '78%' : '88%',
      marginRight: 'auto',
    },
    userText: { color: '#fff', fontSize: r.font(15), lineHeight: r.font(21) },
    assistantText: { color: theme.text, fontSize: r.font(15), lineHeight: r.font(21) },

    valueCard: {
      borderRadius: 12,
      paddingVertical: r.space(9),
      paddingHorizontal: r.space(12),
    },
    valueLabel: { color: theme.textSecondary, fontSize: r.font(11), marginBottom: 2 },
    valueAmount: { fontSize: r.font(19), fontWeight: '700' },

    list: { gap: r.space(8) },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: r.space(9) },
    listIcon: {
      width: r.font(28),
      height: r.font(28),
      borderRadius: r.font(9),
      alignItems: 'center',
      justifyContent: 'center',
    },
    listInfo: { flex: 1 },
    listTitle: { color: theme.text, fontSize: r.font(14), fontWeight: '600' },
    listSubtitle: { color: theme.textSecondary, fontSize: r.font(11), marginTop: 1 },
    listValue: { fontSize: r.font(14), fontWeight: '700' },
    listMore: { color: theme.textSecondary, fontSize: r.font(12), fontStyle: 'italic' },

    actionsBlock: { gap: r.space(6) },
    actionsTitle: {
      color: theme.textSecondary,
      fontSize: r.font(11),
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: r.space(6) },
    chip: {
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: r.space(8),
      paddingHorizontal: r.space(12),
    },
    chipText: { color: theme.primary, fontSize: r.font(13), fontWeight: '600' },

    confirmRow: { flexDirection: 'row', gap: r.space(8) },
    confirmButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: r.space(6),
      height: r.space(44),
      borderRadius: 12,
      backgroundColor: theme.primary,
    },
    confirmText: { color: '#fff', fontSize: r.font(14), fontWeight: '700' },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: r.space(44),
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
    },
    cancelText: { color: theme.textSecondary, fontSize: r.font(14), fontWeight: '600' },
    buttonDisabled: { opacity: 0.6 },

    speakButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.space(4),
      alignSelf: 'flex-start',
      paddingTop: r.space(2),
    },
    speakText: { color: theme.textSecondary, fontSize: r.font(11), fontWeight: '600' },
    seal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.space(7),
      borderRadius: 12,
      paddingVertical: r.space(9),
      paddingHorizontal: r.space(12),
    },
    sealText: { fontSize: r.font(13), fontWeight: '600', flex: 1 },
  });

export default ChatBubble;

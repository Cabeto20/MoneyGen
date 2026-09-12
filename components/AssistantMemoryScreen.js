import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { hydrateMemory, getMemory, unlearnPhrase, forgetEverything } from '../utils/assistant';
import { trainCategoryModel } from '../utils/assistant/memory';
import { getTransactions } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../utils/responsive';

/**
 * Nome de cada intenção em português.
 *
 * Fica na tela, e não junto do motor, porque é dado de apresentação: o motor
 * trabalha com o id e nunca precisa saber como ele se chama para o usuário.
 * Sem isto, a tela mostraria "leftover_after_bills" para quem só quer conferir
 * o que o assistente aprendeu.
 */
const INTENT_LABELS = {
  balance_now: 'Meu saldo',
  wallet_balance: 'Saldo de uma carteira',
  expense_period: 'Quanto gastei',
  income_period: 'Quanto recebi',
  period_summary: 'Resumo do período',
  category_expense: 'Gasto por categoria',
  top_categories: 'Onde mais gasto',
  compare_periods: 'Comparar períodos',
  fastest_growing_category: 'O que mais subiu',
  monthly_average: 'Média mensal',
  bills_due: 'Contas a vencer',
  bills_pending_total: 'Quanto falta pagar',
  leftover_after_bills: 'Quanto sobra',
  bill_amount_changed: 'Conta que mudou de valor',
  budget_exceeded: 'Orçamento estourado',
  budget_remaining: 'Quanto posso gastar na categoria',
  goal_progress: 'Minhas metas',
  goal_monthly_saving: 'Quanto guardar por mês',
  can_i_spend: 'Posso gastar?',
  simulate_installments: 'Simular parcelas',
  daily_allowance: 'Teto por dia',
  insights: 'Dicas',
  help: 'Ajuda',
  add_expense: 'Lançar despesa',
  add_income: 'Lançar receita',
  pay_bill: 'Quitar conta',
};

const labelFor = (intentId) => INTENT_LABELS[intentId] || intentId;

const AssistantMemoryScreen = () => {
  const { theme } = useTheme();
  const r = useResponsive();
  const [loading, setLoading] = useState(true);
  const [phrases, setPhrases] = useState([]);
  const [topIntents, setTopIntents] = useState([]);
  const [categoryLearning, setCategoryLearning] = useState(false);

  const styles = createStyles(theme, r);

  /**
   * `isAlive` existe porque há dois `await` antes do primeiro `setState`: sair
   * da tela no meio da leitura deixaria o `setState` caindo num componente já
   * desmontado. Mesmo cuidado do `useFocusEffect` do ChatScreen.
   */
  const read = useCallback(async (isAlive = () => true) => {
    await hydrateMemory();
    if (!isAlive()) return;

    const memory = getMemory();

    setPhrases([...memory.phrases].sort((a, b) => b.count - a.count));
    setTopIntents(
      Object.keys(memory.intentUses)
        .map((intentId) => ({ intentId, count: memory.intentUses[intentId] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );

    // O modelo de categoria não é guardado em lugar nenhum: ele nasce do
    // histórico a cada pergunta. Aqui ele é treinado só para a tela poder dizer
    // se já existe base suficiente — sem isso, essa parte do aprendizado seria
    // invisível para o usuário.
    const transactions = await getTransactions();
    if (!isAlive()) return;

    setCategoryLearning(trainCategoryModel(transactions).ready);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      read(() => alive);

      return () => {
        alive = false;
      };
    }, [read])
  );

  const handleForgetPhrase = (phrase) => {
    Alert.alert('Esquecer esta frase?', `"${phrase.text}" volta a não ser entendida.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Esquecer',
        style: 'destructive',
        onPress: async () => {
          await unlearnPhrase(phrase.text);
          read();
        },
      },
    ]);
  };

  const handleForgetEverything = () => {
    Alert.alert(
      'Esquecer tudo?',
      'O assistente volta ao estado de fábrica: perde as frases que você ensinou e a ordem do cardápio. Seus lançamentos, contas e metas não são tocados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Esquecer tudo',
          style: 'destructive',
          onPress: async () => {
            await forgetEverything();
            read();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubble-ellipses" size={r.font(24)} color={theme.primary} />
          <Text style={styles.sectionTitle}>Frases que você ensinou</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Quando o assistente não entende e você toca num exemplo logo em seguida, ele guarda
          que a sua frase queria dizer aquilo.
        </Text>

        {phrases.length === 0 ? (
          <Text style={styles.empty}>Nada ensinado ainda.</Text>
        ) : (
          phrases.map((phrase) => (
            <View key={phrase.text} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{phrase.text}</Text>
                <Text style={styles.rowSubtitle}>
                  {labelFor(phrase.intentId)}
                  {phrase.count > 1 ? ` · usada ${phrase.count}x` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleForgetPhrase(phrase)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                // Só o ícone não diz nada em leitor de tela, e são vários botões
                // iguais na lista: o rótulo precisa citar a frase.
                accessibilityLabel={`Esquecer a frase ${phrase.text}`}
              >
                <Ionicons name="close-circle" size={r.font(24)} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart" size={r.font(24)} color={theme.primary} />
          <Text style={styles.sectionTitle}>O que você mais pergunta</Text>
        </View>
        <Text style={styles.sectionDesc}>
          O cardápio de exemplos se reordena por isto, para o que você usa ficar na frente.
        </Text>

        {topIntents.length === 0 ? (
          <Text style={styles.empty}>Ainda sem histórico de perguntas.</Text>
        ) : (
          topIntents.map((item) => (
            <View key={item.intentId} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{labelFor(item.intentId)}</Text>
              </View>
              <Text style={styles.count}>{item.count}x</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="pricetags" size={r.font(24)} color={theme.primary} />
          <Text style={styles.sectionTitle}>Categorias do seu jeito</Text>
        </View>
        <Text style={styles.sectionDesc}>
          {categoryLearning
            ? 'Seus lançamentos já dão base para o assistente adivinhar a categoria pelo nome que só você usa — a padaria da esquina, a barbearia do bairro.'
            : 'Ainda faltam lançamentos categorizados para o assistente aprender a categoria pelo nome do lugar. Continue lançando normalmente.'}
        </Text>
      </View>

      <TouchableOpacity style={styles.dangerButton} onPress={handleForgetEverything}>
        <Ionicons name="trash" size={r.font(20)} color="#fff" />
        <Text style={styles.dangerText}>Esquecer tudo</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Tudo isto fica só neste aparelho e não entra no backup: é o jeito de falar deste
        celular, não um dado seu. Esquecer não apaga nenhum lançamento.
      </Text>
    </ScrollView>
  );
};

const createStyles = (theme, r) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: r.space(20),
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      marginBottom: r.space(32),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: r.space(10),
      marginBottom: r.space(4),
    },
    sectionTitle: {
      fontSize: r.font(20),
      fontWeight: 'bold',
      color: theme.text,
    },
    sectionDesc: {
      fontSize: r.font(14),
      color: theme.textSecondary,
      marginBottom: r.space(16),
      marginLeft: r.space(34),
      lineHeight: r.font(20),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: r.space(14),
      marginBottom: r.space(8),
      gap: r.space(12),
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: r.font(15),
      color: theme.text,
      fontWeight: '600',
    },
    rowSubtitle: {
      fontSize: r.font(12),
      color: theme.textSecondary,
      marginTop: r.space(2),
    },
    count: {
      fontSize: r.font(14),
      color: theme.textSecondary,
      fontWeight: 'bold',
    },
    empty: {
      fontSize: r.font(14),
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginLeft: r.space(34),
    },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: r.space(10),
      backgroundColor: theme.error,
      padding: r.space(16),
      borderRadius: 14,
      marginBottom: r.space(20),
    },
    dangerText: {
      color: '#fff',
      fontSize: r.font(16),
      fontWeight: 'bold',
    },
    footnote: {
      color: theme.textSecondary,
      fontSize: r.font(12),
      lineHeight: r.font(18),
    },
  });

export default AssistantMemoryScreen;

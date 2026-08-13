import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const PlanningRow = ({ theme, styles, icon, color, title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.rowIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
  </TouchableOpacity>
);

const PlanningScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <PlanningRow
          theme={theme}
          styles={styles}
          icon="pie-chart"
          color={theme.primary}
          title="Orçamentos"
          subtitle="Limites mensais por categoria"
          onPress={() => navigation.navigate('Budgets')}
        />
        <PlanningRow
          theme={theme}
          styles={styles}
          icon="flag"
          color={theme.error}
          title="Metas"
          subtitle="Objetivos de economia"
          onPress={() => navigation.navigate('Goals')}
        />
        <PlanningRow
          theme={theme}
          styles={styles}
          icon="card"
          color={theme.success}
          title="Carteiras"
          subtitle="Contas, cartões e dinheiro"
          onPress={() => navigation.navigate('Accounts')}
        />
      </View>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  section: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    marginLeft: 15,
  },
  rowTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
});

export default PlanningScreen;

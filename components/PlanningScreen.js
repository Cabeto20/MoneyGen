import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../utils/responsive';

const PlanningRow = ({ theme, styles, icon, color, title, subtitle, onPress }) => {
  const r = useResponsive();

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={r.font(22)} color={color} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={r.font(20)} color={theme.textSecondary} />
    </TouchableOpacity>
  );
};

const PlanningScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const styles = createStyles(theme, r);

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

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  section: {
    marginTop: r.space(16),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r.gutter,
    paddingVertical: r.space(15),
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
    marginLeft: r.space(15),
  },
  rowTitle: {
    fontSize: r.font(16),
    color: theme.text,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: r.font(14),
    color: theme.textSecondary,
    marginTop: r.space(2),
  },
});

export default PlanningScreen;

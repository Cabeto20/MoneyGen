import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCOUNT_TYPE_MAP } from '../utils/categories';
import { useResponsive } from '../utils/responsive';

const AccountPicker = ({ accounts, selected, onSelect, theme, accentColor }) => {
  const r = useResponsive();
  const styles = createStyles(theme, accentColor, r);

  if (accounts.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {accounts.map(account => {
        const meta = ACCOUNT_TYPE_MAP[account.type] || ACCOUNT_TYPE_MAP.dinheiro;
        const isSelected = selected === account.id;

        return (
          <TouchableOpacity
            key={account.id}
            style={[styles.chip, isSelected && styles.selectedChip]}
            onPress={() => onSelect(account.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={meta.icon}
              size={r.font(18)}
              color={isSelected ? '#fff' : meta.color}
            />
            <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
              {account.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const createStyles = (theme, accentColor, r) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: r.space(10),
    paddingRight: r.space(4),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(8),
    backgroundColor: theme.card,
    paddingHorizontal: r.space(14),
    paddingVertical: r.space(12),
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  selectedChip: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  chipText: {
    color: theme.textSecondary,
    fontSize: r.font(13),
    fontWeight: '600',
  },
  selectedChipText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default AccountPicker;

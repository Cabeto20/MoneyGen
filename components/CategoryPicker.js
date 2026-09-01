import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../utils/responsive';

const CategoryPicker = ({ categories, selected, onSelect, theme, accentColor }) => {
  const r = useResponsive();
  const styles = createStyles(theme, accentColor, r);

  return (
    <View style={styles.categoryGrid}>
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.name}
          style={[styles.categoryButton, selected === cat.name && styles.selectedCategory]}
          onPress={() => onSelect(cat.name)}
        >
          <Ionicons
            name={cat.icon}
            size={r.font(20)}
            color={selected === cat.name ? '#fff' : theme.textSecondary}
          />
          <Text style={[styles.categoryText, selected === cat.name && styles.selectedCategoryText]}>
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (theme, accentColor, r) => StyleSheet.create({
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: r.space(10),
  },
  categoryButton: {
    backgroundColor: theme.card,
    paddingHorizontal: r.space(14),
    paddingVertical: r.space(14),
    borderRadius: 12,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    flexDirection: 'row',
    gap: r.space(8),
  },
  selectedCategory: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  categoryText: {
    color: theme.textSecondary,
    fontSize: r.font(13),
    fontWeight: '600',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CategoryPicker;

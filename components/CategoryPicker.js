import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CategoryPicker = ({ categories, selected, onSelect, theme, accentColor }) => {
  const styles = createStyles(theme, accentColor);

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
            size={20}
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

const createStyles = (theme, accentColor) => StyleSheet.create({
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    flexDirection: 'row',
    gap: 8,
  },
  selectedCategory: {
    backgroundColor: accentColor,
    borderColor: accentColor,
  },
  categoryText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CategoryPicker;

import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../utils/responsive';

const SearchBar = ({ onSearch, placeholder = "Buscar...", containerStyle }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const [searchText, setSearchText] = useState('');

  const styles = createStyles(theme, r);

  const handleSearch = (text) => {
    setSearchText(text);
    onSearch(text);
  };

  const clearSearch = () => {
    setSearchText('');
    onSearch('');
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name="search" size={r.font(20)} color={theme.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        value={searchText}
        onChangeText={handleSearch}
      />
      {searchText.length > 0 && (
        <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
          <Ionicons name="close-circle" size={r.font(20)} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: r.space(15),
    marginHorizontal: r.gutter,
    marginVertical: r.space(10),
    borderWidth: 1.5,
    borderColor: theme.border,
    elevation: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: r.space(10),
  },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: r.font(16),
    paddingVertical: r.space(13),
  },
  clearButton: {
    padding: r.space(5),
  },
});

export default SearchBar;
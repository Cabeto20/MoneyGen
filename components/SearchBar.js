import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const SearchBar = ({ onSearch, placeholder = "Buscar..." }) => {
  const { theme } = useTheme();
  const [searchText, setSearchText] = useState('');

  const styles = createStyles(theme);

  const handleSearch = (text) => {
    setSearchText(text);
    onSearch(text);
  };

  const clearSearch = () => {
    setSearchText('');
    onSearch('');
  };

  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        value={searchText}
        onChangeText={handleSearch}
      />
      {searchText.length > 0 && (
        <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: theme.border,
    elevation: 1,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 16,
    paddingVertical: 13,
  },
  clearButton: {
    padding: 5,
  },
});

export default SearchBar;
import React, { useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addAccount, updateAccount } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_MAP } from '../utils/categories';
import { useAmountInput } from '../utils/useAmountInput';

const AddAccountScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const editing = route?.params?.account || null;

  const [name, setName] = useState(editing?.name || '');
  const [type, setType] = useState(editing?.type || 'dinheiro');
  const [saving, setSaving] = useState(false);
  const { amount, displayAmount, handleAmountChange } = useAmountInput(
    editing?.initialBalance ?? null
  );

  const meta = ACCOUNT_TYPE_MAP[type] || ACCOUNT_TYPE_MAP.dinheiro;
  const styles = createStyles(theme, meta.color);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editing ? 'Editar Carteira' : 'Nova Carteira' });
  }, [navigation, editing]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'Informe o nome da carteira');
      return;
    }

    // Saldo inicial é opcional e pode ser zero — parseFloat direto, sem exigir > 0.
    const initialBalance = amount ? parseFloat(amount) : 0;

    try {
      setSaving(true);

      if (editing) {
        await updateAccount(editing.id, { name: name.trim(), type, initialBalance });
      } else {
        await addAccount({ name: name.trim(), type, initialBalance });
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar carteira');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <View style={styles.preview}>
          <View style={[styles.previewIcon, { backgroundColor: meta.color + '20' }]}>
            <Ionicons name={meta.icon} size={30} color={meta.color} />
          </View>
          <Text style={styles.previewName}>{name.trim() || 'Nova carteira'}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Nubank"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.typeGrid}>
            {ACCOUNT_TYPES.map(item => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.typeButton,
                  type === item.key && { backgroundColor: item.color, borderColor: item.color },
                ]}
                onPress={() => setType(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={type === item.key ? '#fff' : item.color}
                />
                <Text style={[styles.typeText, type === item.key && styles.typeTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Saldo inicial</Text>
          <TextInput
            style={styles.input}
            placeholder="R$ 0,00"
            placeholderTextColor={theme.textSecondary}
            value={displayAmount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
          />
          <Text style={styles.hint}>
            Quanto já existe nesta carteira hoje. As receitas e despesas lançadas depois somam
            ou subtraem deste valor.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.saveButtonText}>
            {editing ? 'Salvar Alterações' : 'Criar Carteira'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme, accent) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  form: {
    padding: 20,
  },
  preview: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  previewIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: theme.text,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.card,
    color: theme.text,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  hint: {
    color: theme.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  typeText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: accent,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default AddAccountScreen;

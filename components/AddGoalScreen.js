import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { addGoal, updateGoal } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';
import { GOAL_ICONS, GOAL_COLORS } from '../utils/categories';
import { useAmountInput } from '../utils/useAmountInput';
import { parseValidAmount } from '../utils/validateAmount';

const AddGoalScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const editing = route?.params?.goal || null;

  const [name, setName] = useState(editing?.name || '');
  const [icon, setIcon] = useState(editing?.icon || GOAL_ICONS[0]);
  const [color, setColor] = useState(editing?.color || GOAL_COLORS[0]);
  const [hasDeadline, setHasDeadline] = useState(!!editing?.deadline);
  const [deadline, setDeadline] = useState(() => {
    if (editing?.deadline) return new Date(editing.deadline);

    const oneYearAhead = new Date();
    oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
    return oneYearAhead;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const target = useAmountInput(editing?.targetAmount ?? null);
  const initial = useAmountInput();

  const styles = createStyles(theme, color);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editing ? 'Editar Meta' : 'Nova Meta' });
  }, [navigation, editing]);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDeadline(selectedDate);
  };

  const handleSave = async () => {
    if (!name.trim() || !target.amount) {
      Alert.alert('Erro', 'Informe o nome e o valor da meta');
      return;
    }

    const targetAmount = parseValidAmount(target.amount);
    if (targetAmount === null) {
      Alert.alert('Erro', 'O valor da meta deve ser maior que zero');
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        await updateGoal(editing.id, {
          name: name.trim(),
          targetAmount,
          icon,
          color,
          deadline: hasDeadline ? deadline : null,
        });
      } else {
        await addGoal({
          name: name.trim(),
          targetAmount,
          savedAmount: parseValidAmount(initial.amount) || 0,
          icon,
          color,
          deadline: hasDeadline ? deadline : null,
        });
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar meta');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <View style={styles.preview}>
          <View style={[styles.previewIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={30} color={color} />
          </View>
          <Text style={styles.previewName}>{name.trim() || 'Sua meta'}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Viagem de férias"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Quanto quer juntar</Text>
          <TextInput
            style={styles.input}
            placeholder="R$ 0,00"
            placeholderTextColor={theme.textSecondary}
            value={target.displayAmount}
            onChangeText={target.handleAmountChange}
            keyboardType="numeric"
          />
        </View>

        {!editing && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Já guardado (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="R$ 0,00"
              placeholderTextColor={theme.textSecondary}
              value={initial.displayAmount}
              onChangeText={initial.handleAmountChange}
              keyboardType="numeric"
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Definir prazo</Text>
            <Switch
              value={hasDeadline}
              onValueChange={setHasDeadline}
              trackColor={{ false: theme.border, true: color }}
              thumbColor="#fff"
            />
          </View>
          {hasDeadline && (
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color={color} />
              <Text style={styles.dateButtonText}>{deadline.toLocaleDateString('pt-BR')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={deadline}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ícone</Text>
          <View style={styles.iconGrid}>
            {GOAL_ICONS.map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.iconOption, icon === item && styles.iconOptionSelected]}
                onPress={() => setIcon(item)}
              >
                <Ionicons
                  name={item}
                  size={22}
                  color={icon === item ? '#fff' : theme.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cor</Text>
          <View style={styles.colorRow}>
            {GOAL_COLORS.map(item => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.colorOption,
                  { backgroundColor: item },
                  color === item && styles.colorOptionSelected,
                ]}
                onPress={() => setColor(item)}
              >
                {color === item && <Ionicons name="checkmark" size={18} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.saveButtonText}>
            {editing ? 'Salvar Alterações' : 'Criar Meta'}
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  dateButton: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: {
    color: theme.text,
    fontSize: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  iconOptionSelected: {
    backgroundColor: accent,
    borderColor: accent,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: theme.text,
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

export default AddGoalScreen;

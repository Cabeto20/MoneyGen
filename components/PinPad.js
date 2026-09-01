import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PIN_LENGTH } from '../utils/security';
import { useResponsive } from '../utils/responsive';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Teclado numérico de PIN. Dispara `onComplete` assim que o buffer atinge
 * PIN_LENGTH; quem consome decide se aceita ou rejeita. Mudar `resetKey`
 * limpa o buffer (usado ao trocar de etapa ou após erro).
 */
const PinPad = ({
  theme,
  title,
  subtitle,
  error,
  onComplete,
  onBiometric,
  biometricLabel,
  biometricIcon = 'finger-print',
  resetKey,
}) => {
  const r = useResponsive();
  const [digits, setDigits] = useState('');
  const styles = createStyles(theme, r);

  useEffect(() => {
    setDigits('');
  }, [resetKey]);

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      onComplete(digits);
    }
  }, [digits]);

  const press = (key) => {
    if (digits.length >= PIN_LENGTH) return;
    setDigits(digits + key);
  };

  const backspace = () => setDigits(digits.slice(0, -1));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < digits.length && styles.dotFilled,
              !!error && styles.dotError,
            ]}
          />
        ))}
      </View>

      <Text style={[styles.error, !error && styles.errorHidden]}>{error || ' '}</Text>

      <View style={styles.keypad}>
        {KEYS.map(key => (
          <TouchableOpacity
            key={key}
            style={styles.key}
            onPress={() => press(key)}
            activeOpacity={0.6}
          >
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.key}
          onPress={onBiometric}
          disabled={!onBiometric}
          activeOpacity={0.6}
        >
          {!!onBiometric && (
            <Ionicons name={biometricIcon} size={r.font(26)} color={theme.primary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.key} onPress={() => press('0')} activeOpacity={0.6}>
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.key} onPress={backspace} activeOpacity={0.6}>
          <Ionicons name="backspace-outline" size={r.font(24)} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {!!onBiometric && !!biometricLabel && (
        <TouchableOpacity style={styles.biometricLink} onPress={onBiometric}>
          <Ionicons name={biometricIcon} size={r.font(16)} color={theme.primary} />
          <Text style={styles.biometricLinkText}>Usar {biometricLabel.toLowerCase()}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: r.font(20),
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: r.font(14),
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: r.space(6),
  },
  dots: {
    flexDirection: 'row',
    gap: r.space(16),
    marginTop: r.space(28),
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.border,
  },
  dotFilled: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  dotError: {
    borderColor: theme.error,
  },
  error: {
    color: theme.error,
    fontSize: r.font(13),
    fontWeight: '600',
    marginTop: r.space(14),
    height: 18,
  },
  errorHidden: {
    opacity: 0,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: r.space(14),
    marginTop: r.space(14),
    maxWidth: 260,
  },
  key: {
    width: 72,
    height: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card,
  },
  keyText: {
    fontSize: r.font(24),
    fontWeight: '600',
    color: theme.text,
  },
  biometricLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(6),
    marginTop: r.space(22),
    paddingVertical: r.space(8),
  },
  biometricLinkText: {
    color: theme.primary,
    fontSize: r.font(14),
    fontWeight: '600',
  },
});

export default PinPad;

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { verifyPin, authenticateWithBiometrics } from '../utils/security';
import PinPad from './PinPad';

/**
 * Tela de desbloqueio. Tenta a biometria automaticamente na abertura e cai
 * para o PIN quando ela falha, não está disponível ou o usuário cancela.
 */
const LockScreen = ({ security, onUnlock }) => {
  const { theme } = useTheme();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const styles = createStyles(theme);
  const canUseBiometrics = security.canUseBiometrics;

  const tryBiometrics = useCallback(async () => {
    if (!canUseBiometrics) return;

    const success = await authenticateWithBiometrics();
    if (success) onUnlock();
  }, [canUseBiometrics, onUnlock]);

  useEffect(() => {
    tryBiometrics();
  }, [tryBiometrics]);

  const handlePinComplete = async (pin) => {
    if (await verifyPin(pin)) {
      setError('');
      onUnlock();
      return;
    }

    setError('PIN incorreto');
    setAttempt(value => value + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <Ionicons name="lock-closed" size={30} color={theme.primary} />
        </View>
        <Text style={styles.brandName}>MoneyGen</Text>
      </View>

      <PinPad
        theme={theme}
        title="App bloqueado"
        subtitle="Digite seu PIN para continuar"
        error={error}
        resetKey={attempt}
        onComplete={handlePinComplete}
        onBiometric={canUseBiometrics ? tryBiometrics : undefined}
        biometricLabel={canUseBiometrics ? security.biometrics.label : undefined}
      />
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 36,
  },
  brandIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
  },
});

export default LockScreen;

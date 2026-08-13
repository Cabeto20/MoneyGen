import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, AppState, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getSecurityState } from '../utils/security';
import LockScreen from './LockScreen';

// Janela em que voltar ao app não pede autenticação de novo — evita irritar
// quem só saiu para copiar um valor de outro app.
const GRACE_PERIOD_MS = 30 * 1000;

/**
 * Envolve o app e sobrepõe a tela de bloqueio quando necessário. A árvore de
 * navegação continua montada por baixo, então o estado das telas é preservado.
 */
const LockGate = ({ children }) => {
  const { theme } = useTheme();
  const [security, setSecurity] = useState(null);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const backgroundedAt = useRef(null);

  const refreshSecurity = useCallback(async () => {
    const state = await getSecurityState();
    setSecurity(state);
    return state;
  }, []);

  useEffect(() => {
    refreshSecurity().then(state => {
      setLocked(state.lockEnabled);
      setChecking(false);
    });
  }, [refreshSecurity]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }

      if (nextState !== 'active') return;

      // Configurações podem ter mudado dentro do app desde a última checagem.
      const state = await refreshSecurity();
      if (!state.lockEnabled) {
        setLocked(false);
        return;
      }

      const awayFor = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      if (awayFor > GRACE_PERIOD_MS) setLocked(true);
    });

    return () => subscription.remove();
  }, [refreshSecurity]);

  if (checking) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {children}
      {locked && !!security && (
        <View style={styles.overlay}>
          <LockScreen security={security} onUnlock={() => setLocked(false)} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
});

export default LockGate;

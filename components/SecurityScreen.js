import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import {
  getSecurityState,
  setPin,
  verifyPin,
  setLockEnabled,
  setBiometricEnabled,
  disableLock,
} from '../utils/security';
import PinPad from './PinPad';

const FLOW_COPY = {
  current: { title: 'PIN atual', subtitle: 'Confirme o PIN em uso' },
  create: { title: 'Novo PIN', subtitle: 'Escolha 4 dígitos' },
  confirm: { title: 'Repita o PIN', subtitle: 'Digite novamente para confirmar' },
};

const SecurityScreen = () => {
  const { theme } = useTheme();
  const [security, setSecurity] = useState(null);
  const [flow, setFlow] = useState(null);

  const styles = createStyles(theme);

  const loadSecurity = useCallback(async () => {
    setSecurity(await getSecurityState());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSecurity();
    }, [loadSecurity])
  );

  if (!security) return <View style={styles.container} />;

  const handleToggleLock = (enabled) => {
    if (enabled) {
      setFlow({ step: 'create', intent: 'enable' });
      return;
    }

    Alert.alert(
      'Desativar bloqueio',
      'O app deixará de pedir PIN ou biometria ao abrir. Seu PIN será apagado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: async () => {
            await disableLock();
            await loadSecurity();
          },
        },
      ]
    );
  };

  const handleToggleBiometrics = async (enabled) => {
    await setBiometricEnabled(enabled);
    await loadSecurity();
  };

  const finishPinSetup = async (pin) => {
    await setPin(pin);
    await setLockEnabled(true);
    setFlow(null);
    await loadSecurity();
    Alert.alert('Pronto', 'O bloqueio do app está ativo.');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons
            name={security.lockEnabled ? 'lock-closed' : 'lock-open'}
            size={26}
            color={theme.primary}
          />
        </View>
        <Text style={styles.introTitle}>
          {security.lockEnabled ? 'App protegido' : 'App desprotegido'}
        </Text>
        <Text style={styles.introText}>
          {security.lockEnabled
            ? 'Ao abrir o app será necessário confirmar sua identidade.'
            : 'Qualquer pessoa com acesso ao aparelho pode ver suas finanças.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bloqueio</Text>

        <View style={styles.item}>
          <View style={styles.itemLeft}>
            <Ionicons name="lock-closed-outline" size={24} color={theme.primary} />
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>Bloquear o app</Text>
              <Text style={styles.itemSubtitle}>
                {security.lockEnabled ? 'Ativado' : 'Desativado'}
              </Text>
            </View>
          </View>
          <Switch
            value={security.lockEnabled}
            onValueChange={handleToggleLock}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor="#fff"
          />
        </View>

        {security.lockEnabled && (
          <TouchableOpacity
            style={styles.item}
            onPress={() => setFlow({ step: 'current', intent: 'change' })}
          >
            <View style={styles.itemLeft}>
              <Ionicons name="keypad-outline" size={24} color={theme.primary} />
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>Alterar PIN</Text>
                <Text style={styles.itemSubtitle}>Trocar os 4 dígitos de acesso</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {security.lockEnabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biometria</Text>

          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Ionicons name="finger-print-outline" size={24} color={theme.primary} />
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{security.biometrics.label}</Text>
                <Text style={styles.itemSubtitle}>
                  {!security.biometrics.hasHardware
                    ? 'Não disponível neste aparelho'
                    : !security.biometrics.isEnrolled
                    ? 'Cadastre uma biometria nas configurações do sistema'
                    : security.biometricEnabled
                    ? 'Ativada'
                    : 'Desativada'}
                </Text>
              </View>
            </View>
            <Switch
              value={security.canUseBiometrics}
              onValueChange={handleToggleBiometrics}
              disabled={!security.biometrics.available}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      )}

      <Text style={styles.footnote}>
        O PIN é guardado no cofre do sistema (Keystore/Keychain), não junto com os dados do app.
        Se você esquecê-lo, será preciso reinstalar o app — faça backup antes.
      </Text>

      {!!flow && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setFlow(null)}>
          <PinFlow
            theme={theme}
            flow={flow}
            onCancel={() => setFlow(null)}
            onAdvance={setFlow}
            onFinish={finishPinSetup}
          />
        </Modal>
      )}
    </ScrollView>
  );
};

/** Máquina de etapas do PIN: current → create → confirm. */
const PinFlow = ({ theme, flow, onCancel, onAdvance, onFinish }) => {
  const styles = createStyles(theme);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const copy = FLOW_COPY[flow.step];

  const retry = (message) => {
    setError(message);
    setAttempt(value => value + 1);
  };

  const handleComplete = async (pin) => {
    setError('');

    if (flow.step === 'current') {
      if (await verifyPin(pin)) {
        onAdvance({ ...flow, step: 'create' });
        return;
      }
      retry('PIN incorreto');
      return;
    }

    if (flow.step === 'create') {
      onAdvance({ ...flow, step: 'confirm', pin });
      return;
    }

    if (pin !== flow.pin) {
      onAdvance({ ...flow, step: 'create', pin: undefined });
      retry('Os PINs não coincidem');
      return;
    }

    onFinish(pin);
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <PinPad
          theme={theme}
          title={copy.title}
          subtitle={copy.subtitle}
          error={error}
          resetKey={`${flow.step}-${attempt}`}
          onComplete={handleComplete}
        />

        <TouchableOpacity style={styles.modalCancel} onPress={onCancel}>
          <Text style={styles.modalCancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  intro: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 8,
    gap: 8,
  },
  introIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: theme.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  introText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemText: {
    marginLeft: 15,
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  itemSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  footnote: {
    color: theme.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    padding: 20,
    paddingTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modalCancel: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalCancelText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SecurityScreen;

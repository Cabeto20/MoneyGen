import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCK_ENABLED_KEY = 'lockEnabled';
const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

// O PIN vai para o SecureStore (Keystore/Keychain do sistema), não para o
// AsyncStorage, que guarda texto puro acessível em um device com root.
const PIN_KEY = 'appPin';

export const PIN_LENGTH = 4;

export const getLockEnabled = async () => {
  try {
    return (await AsyncStorage.getItem(LOCK_ENABLED_KEY)) === 'true';
  } catch (error) {
    return false;
  }
};

export const setLockEnabled = async (enabled) => {
  await AsyncStorage.setItem(LOCK_ENABLED_KEY, String(enabled));
};

export const getBiometricEnabled = async () => {
  try {
    return (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) !== 'false';
  } catch (error) {
    return true;
  }
};

export const setBiometricEnabled = async (enabled) => {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
};

export const hasPin = async () => {
  try {
    return !!(await SecureStore.getItemAsync(PIN_KEY));
  } catch (error) {
    return false;
  }
};

export const setPin = async (pin) => {
  await SecureStore.setItemAsync(PIN_KEY, String(pin));
};

export const verifyPin = async (pin) => {
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    return !!stored && stored === String(pin);
  } catch (error) {
    return false;
  }
};

export const clearPin = async () => {
  try {
    await SecureStore.deleteItemAsync(PIN_KEY);
  } catch (error) {
    // Nada cadastrado — nada a limpar.
  }
};

/**
 * Desliga o bloqueio por completo: apaga o PIN e volta os flags ao padrão.
 */
export const disableLock = async () => {
  await clearPin();
  await setLockEnabled(false);
};

const describeBiometrics = (types) => {
  const { FACIAL_RECOGNITION, FINGERPRINT, IRIS } = LocalAuthentication.AuthenticationType;
  if (types.includes(FACIAL_RECOGNITION)) return 'Reconhecimento facial';
  if (types.includes(FINGERPRINT)) return 'Impressão digital';
  if (types.includes(IRIS)) return 'Leitura de íris';
  return 'Biometria';
};

/**
 * `available` só é true quando o aparelho tem sensor E o usuário já cadastrou
 * uma biometria — sem cadastro, `authenticateAsync` falha direto.
 */
export const getBiometricAvailability = async () => {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    return {
      hasHardware,
      isEnrolled,
      available: hasHardware && isEnrolled,
      label: describeBiometrics(types || []),
    };
  } catch (error) {
    return { hasHardware: false, isEnrolled: false, available: false, label: 'Biometria' };
  }
};

export const authenticateWithBiometrics = async () => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloqueie o MoneyGen',
      cancelLabel: 'Usar PIN',
      fallbackLabel: 'Usar PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch (error) {
    return false;
  }
};

/** Estado consolidado usado pela tela de bloqueio e pela de segurança. */
export const getSecurityState = async () => {
  const [lockEnabled, biometricEnabled, pinSet, biometrics] = await Promise.all([
    getLockEnabled(),
    getBiometricEnabled(),
    hasPin(),
    getBiometricAvailability(),
  ]);

  return {
    lockEnabled: lockEnabled && pinSet,
    biometricEnabled,
    hasPin: pinSet,
    biometrics,
    canUseBiometrics: biometricEnabled && biometrics.available,
  };
};

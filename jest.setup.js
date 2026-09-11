/**
 * Mocks dos módulos nativos. O app inteiro depende de AsyncStorage, e as telas
 * puxam notificações e SecureStore na cadeia de imports — sem estes mocks, o
 * Jest quebra antes de renderizar qualquer componente.
 */
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

// A tela do chat é a primeira do projeto a usar safe-area. Fora do app real não
// há provider, então o inset vira zero.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

// O React Navigation só é usado pelas telas; os testes passam navigation falso.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const { useEffect } = require('react');
    useEffect(() => callback(), []);
  },
  useNavigation: () => ({ navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() }),
}));

// @expo/vector-icons puxa expo-font e expo-asset na cadeia de imports. O ícone
// não interessa ao teste, mas o `name` sim — renderizá-lo como texto acessível
// permite afirmar qual ícone apareceu (o selo de confirmação, por exemplo).
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const React = require('react');
  const Icon = ({ name, ...props }) =>
    React.createElement(Text, { ...props, testID: `icon-${name}` }, '');
  return { Ionicons: Icon, MaterialIcons: Icon, FontAwesome: Icon };
});

// expo-speech puxa o módulo nativo de TTS. Nos testes interessa saber o que
// foi falado e quando parou, não produzir áudio.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(async () => false),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'deviceId';

/**
 * Identificador desta instalação, sorteado uma vez e guardado no storage. Ele
 * prefixa todo id gerado aqui para que dois aparelhos nunca produzam o mesmo —
 * a versão anterior devolvia `Date.now()` puro, então celular e tablet lançando
 * no mesmo milissegundo geravam o mesmo id e um registro apagava o outro na
 * hora de fundir os dados.
 *
 * Fica em memória porque `generateId` é síncrona (é chamada dentro de `.map()`
 * em importações em lote) e o storage é assíncrono.
 */
let deviceId = null;
let counter = 0;

const buildDeviceId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Carrega (ou cria) o id do aparelho. Chamada no boot, antes das telas. */
export const initDeviceId = async () => {
  if (deviceId) return deviceId;

  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      deviceId = stored;
      return deviceId;
    }

    deviceId = buildDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch (error) {
    // Storage indisponível: segue com um id só desta sessão. Pior caso, os
    // registros criados agora ficam com prefixo diferente — continuam únicos.
    deviceId = buildDeviceId();
  }

  return deviceId;
};

export const getDeviceId = () => deviceId;

/**
 * Id único entre aparelhos: `<aparelho>-<instante>-<contador>`. O contador
 * desempata criações dentro do mesmo milissegundo (importação de extrato cria
 * dezenas de uma vez); o instante desempata entre sessões, já que o contador
 * zera a cada abertura do app.
 */
export const generateId = () => {
  if (!deviceId) deviceId = buildDeviceId();
  counter += 1;
  return `${deviceId}-${Date.now().toString(36)}-${counter}`;
};

import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Voz do assistente (texto para fala).
 *
 * Usa o motor de TTS do próprio Android (`expo-speech` só embrulha o
 * `android.speech.tts.TextToSpeech`), então continua funcionando sem internet
 * — que é a premissa do assistente inteiro. Nenhum áudio sai do aparelho.
 */

const VOICE_ENABLED_KEY = 'chatVoiceEnabled';

export const VOICE_LANGUAGE = 'pt-BR';

// Um pouco abaixo do padrão: number falado rápido em pt-BR fica difícil de
// acompanhar, e a resposta do assistente é quase toda valor e data.
const VOICE_RATE = 0.95;

export const getVoiceEnabled = async () => {
  try {
    return (await AsyncStorage.getItem(VOICE_ENABLED_KEY)) === 'true';
  } catch (error) {
    console.error('Erro ao ler preferência de voz:', error);
    return false;
  }
};

export const setVoiceEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(VOICE_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Erro ao salvar preferência de voz:', error);
  }
};

/**
 * Deixa o texto pronto para ser falado.
 *
 * O assistente escreve para a tela: usa "·" como separador, "R$" e quebras de
 * linha com marcador. Lido em voz alta, isso vira ruído — o TTS soletra o
 * símbolo ou faz uma pausa estranha no meio do valor.
 */
export const toSpeakableText = (text) =>
  String(text ?? '')
    .replace(/R\$\s?/g, '')
    .replace(/[·•]/g, ',')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s*\n\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

export const stopSpeaking = () => {
  try {
    Speech.stop();
  } catch (error) {
    console.error('Erro ao parar a voz:', error);
  }
};

/**
 * Fala o texto, interrompendo o que estiver em curso. Interromper é o
 * comportamento certo aqui: se o usuário já mandou outra pergunta, a resposta
 * anterior perdeu a validade — deixar as duas falando por cima é pior.
 */
export const speak = (text, options = {}) => {
  const speakable = toSpeakableText(text);
  if (!speakable) return;

  try {
    Speech.stop();
    Speech.speak(speakable, {
      language: VOICE_LANGUAGE,
      rate: VOICE_RATE,
      onDone: options.onDone,
      onStopped: options.onStopped,
      onError: (error) => {
        // Aparelho sem voz em pt-BR instalada cai aqui. Não vale interromper o
        // chat por isso: a resposta continua na tela.
        console.error('Erro na síntese de voz:', error);
        if (options.onError) options.onError(error);
      },
    });
  } catch (error) {
    console.error('Erro ao falar:', error);
  }
};

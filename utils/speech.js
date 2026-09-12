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

/**
 * Voz masculina em pt-BR.
 *
 * O `expo-speech` não expõe gênero — a lista traz só `identifier`, `name`,
 * `language` e `quality`. O gênero só aparece dentro do identificador que o
 * motor do Android usa (`pt-br-x-pte#male_1-local`), então a escolha é por
 * marcador no texto mesmo. Sem voz masculina instalada, fica `null` e o TTS
 * usa a padrão do aparelho: melhor a voz errada que o assistente mudo.
 */
let preferredVoice = null;
let voiceLookup = null;

/**
 * A armadilha: "female" contém "male". Testar `includes('male')` primeiro
 * escolheria exatamente a voz que se quer evitar, então o feminino é
 * descartado antes de qualquer coisa.
 */
const describesFemale = (haystack) =>
  haystack.includes('female') || haystack.includes('feminin');

const describesMale = (haystack) =>
  !describesFemale(haystack) && (haystack.includes('male') || haystack.includes('masculin'));

const voiceText = (voice) => `${voice?.identifier || ''} ${voice?.name || ''}`.toLowerCase();

// Android devolve tanto "pt-BR" quanto "pt_BR" dependendo do motor.
const speaksLanguage = (voice) =>
  String(voice?.language || '').replace('_', '-').toLowerCase() === VOICE_LANGUAGE.toLowerCase();

/**
 * Local ganha de rede sempre. O assistente inteiro funciona sem internet; uma
 * voz `-network` deixaria a fala calada justamente quando o resto continua
 * respondendo.
 */
const rankVoice = (voice) => {
  const text = voiceText(voice);
  let rank = 0;
  if (!text.includes('network')) rank += 10;
  if (voice?.quality === 'Enhanced') rank += 5;
  return rank;
};

const pickMaleVoice = (voices) => {
  const candidates = (Array.isArray(voices) ? voices : [])
    .filter((voice) => speaksLanguage(voice) && describesMale(voiceText(voice)))
    .sort((a, b) => rankVoice(b) - rankVoice(a));

  return candidates.length > 0 ? candidates[0].identifier : null;
};

/**
 * Descobre a voz uma vez por sessão. Chamada no foco do chat para a primeira
 * resposta já sair na voz certa — a consulta é assíncrona e `speak` não é.
 */
export const prepareVoice = () => {
  if (!voiceLookup) {
    voiceLookup = Promise.resolve()
      .then(() => Speech.getAvailableVoicesAsync())
      .then((voices) => {
        preferredVoice = pickMaleVoice(voices);
        return preferredVoice;
      })
      .catch((error) => {
        // Motor de TTS ausente ou sem permissão. Segue com a voz padrão.
        console.error('Erro ao listar as vozes disponíveis:', error);
        preferredVoice = null;
        return null;
      });
  }
  return voiceLookup;
};

/** Só para teste: descarta a voz escolhida e a consulta em curso. */
export const resetVoice = () => {
  preferredVoice = null;
  voiceLookup = null;
};

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

  // Dispara a descoberta se ninguém preparou antes. `speak` é síncrona de
  // propósito (a tela fala no mesmo instante em que a bolha nasce), então a
  // primeira fala pode sair na voz padrão — da segunda em diante, na masculina.
  prepareVoice();

  try {
    Speech.stop();
    Speech.speak(speakable, {
      language: VOICE_LANGUAGE,
      rate: VOICE_RATE,
      ...(preferredVoice ? { voice: preferredVoice } : null),
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

import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  toSpeakableText,
  speak,
  stopSpeaking,
  getVoiceEnabled,
  setVoiceEnabled,
  prepareVoice,
  resetVoice,
  VOICE_LANGUAGE,
} from '../speech';

const voice = (identifier, extra = {}) => ({
  identifier,
  name: identifier,
  language: 'pt-BR',
  quality: 'Default',
  ...extra,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetVoice();
  Speech.getAvailableVoicesAsync.mockResolvedValue([]);
});

describe('preparo do texto para a voz', () => {
  // O assistente escreve para a tela; lido em voz alta, o "R$" vira "erre
  // cifrão" e o "·" vira uma pausa sem sentido no meio do valor.
  it('tira o símbolo de moeda, que o TTS soletraria', () => {
    expect(toSpeakableText('Você gastou R$ 1.234,56 esse mês.')).toBe(
      'Você gastou 1.234,56 esse mês.'
    );
  });

  it('troca o separador visual por vírgula', () => {
    expect(toSpeakableText('Energia · R$ 210,00')).toBe('Energia , 210,00');
  });

  it('transforma quebra de linha em pausa de frase', () => {
    expect(toSpeakableText('Três coisas:\n\nprimeira\nsegunda')).toBe(
      'Três coisas:. primeira. segunda'
    );
  });

  it('remove o marcador de lista', () => {
    expect(toSpeakableText('- Energia vence hoje')).toBe('Energia vence hoje');
  });

  it('não quebra com texto vazio ou nulo', () => {
    expect(toSpeakableText('')).toBe('');
    expect(toSpeakableText(null)).toBe('');
    expect(toSpeakableText(undefined)).toBe('');
  });
});

describe('falar', () => {
  it('fala em português com a velocidade reduzida', () => {
    speak('Seu saldo é R$ 100,00.');

    expect(Speech.speak).toHaveBeenCalledTimes(1);
    const [text, options] = Speech.speak.mock.calls[0];
    expect(text).toBe('Seu saldo é 100,00.');
    expect(options.language).toBe(VOICE_LANGUAGE);
    expect(options.rate).toBeLessThan(1);
  });

  // Deixar duas respostas falando por cima é pior do que cortar a anterior:
  // se o usuário já perguntou outra coisa, a primeira perdeu a validade.
  it('interrompe a fala anterior antes de começar a nova', () => {
    speak('primeira');

    expect(Speech.stop).toHaveBeenCalled();
  });

  it('não chama o TTS quando não sobra nada para falar', () => {
    speak('   ');

    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('stopSpeaking para o TTS', () => {
    stopSpeaking();

    expect(Speech.stop).toHaveBeenCalledTimes(1);
  });

  // Aparelho sem voz em pt-BR instalada cai no onError; a resposta continua na
  // tela, então não vale derrubar nada por causa disso.
  it('erro de síntese não propaga', () => {
    speak('qualquer coisa');
    const { onError } = Speech.speak.mock.calls[0][1];

    expect(() => onError(new Error('voz indisponível'))).not.toThrow();
  });
});

describe('escolha da voz masculina', () => {
  it('escolhe a voz masculina em pt-BR', async () => {
    Speech.getAvailableVoicesAsync.mockResolvedValue([
      voice('pt-br-x-afs#female_1-local'),
      voice('pt-br-x-pte#male_1-local'),
    ]);

    expect(await prepareVoice()).toBe('pt-br-x-pte#male_1-local');
  });

  // A armadilha que motivou o código: "female" contém "male", então um
  // `includes('male')` ingênuo escolheria justamente a voz feminina.
  it('não confunde "female" com "male"', async () => {
    Speech.getAvailableVoicesAsync.mockResolvedValue([voice('pt-br-x-afs#female_2-local')]);

    expect(await prepareVoice()).toBeNull();
  });

  // A fala tem que continuar funcionando sem internet, como o resto do app.
  it('prefere a voz local à de rede', async () => {
    Speech.getAvailableVoicesAsync.mockResolvedValue([
      voice('pt-br-x-pte#male_1-network'),
      voice('pt-br-x-pte#male_2-local'),
    ]);

    expect(await prepareVoice()).toBe('pt-br-x-pte#male_2-local');
  });

  it('ignora voz masculina de outro idioma', async () => {
    Speech.getAvailableVoicesAsync.mockResolvedValue([
      voice('en-us-x-iom#male_1-local', { language: 'en-US' }),
    ]);

    expect(await prepareVoice()).toBeNull();
  });

  it('aceita o idioma escrito com underline, como alguns motores devolvem', async () => {
    Speech.getAvailableVoicesAsync.mockResolvedValue([
      voice('pt-br-x-pte#male_1-local', { language: 'pt_BR' }),
    ]);

    expect(await prepareVoice()).toBe('pt-br-x-pte#male_1-local');
  });

  it('consulta o TTS uma vez só, mesmo com várias chamadas', async () => {
    await Promise.all([prepareVoice(), prepareVoice(), prepareVoice()]);

    expect(Speech.getAvailableVoicesAsync).toHaveBeenCalledTimes(1);
  });

  // Sem voz masculina instalada o assistente não pode emudecer: fala com a
  // padrão do aparelho.
  it('fala mesmo sem nenhuma voz masculina disponível', async () => {
    await prepareVoice();
    speak('Seu saldo é R$ 100,00.');

    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak.mock.calls[0][1].voice).toBeUndefined();
  });

  it('fala com a voz masculina depois de descobri-la', async () => {
    Speech.getAvailableVoicesAsync.mockResolvedValue([voice('pt-br-x-pte#male_1-local')]);
    await prepareVoice();

    speak('Seu saldo é R$ 100,00.');

    expect(Speech.speak.mock.calls[0][1].voice).toBe('pt-br-x-pte#male_1-local');
  });

  it('erro ao listar as vozes não derruba a fala', async () => {
    Speech.getAvailableVoicesAsync.mockRejectedValue(new Error('sem motor de TTS'));

    await expect(prepareVoice()).resolves.toBeNull();
    expect(() => speak('qualquer coisa')).not.toThrow();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });
});

describe('preferência de voz', () => {
  it('vem desligada por padrão', async () => {
    expect(await getVoiceEnabled()).toBe(false);
  });

  it('liga e desliga, sobrevivendo ao reinício', async () => {
    await setVoiceEnabled(true);
    expect(await getVoiceEnabled()).toBe(true);

    await setVoiceEnabled(false);
    expect(await getVoiceEnabled()).toBe(false);
  });
});

import React from 'react';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import { Alert, Keyboard, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatScreen from '../ChatScreen';
import { askAssistant, runPendingAction } from '../../utils/assistant';

/**
 * Lembrete: no Testing Library 14 o `render` é assíncrono e as queries vivem no
 * `screen`. Sem o await, toda query falha com "render function has not been
 * called".
 */

jest.mock('../../utils/assistant', () => ({
  askAssistant: jest.fn(),
  runPendingAction: jest.fn(),
  warmSemanticIndex: jest.fn(async () => true),
  hydrateMemory: jest.fn(async () => ({ phrases: [], intentUses: {} })),
  CAPABILITY_GROUPS: [
    { title: 'Saldo e gastos', items: [{ id: 'balance', label: 'Meu saldo', text: 'quanto tenho?' }] },
  ],
}));

jest.mock('../../database/database', () => ({
  getBalance: jest.fn(async () => ({ income: 0, expense: 0, balance: 100 })),
  getBills: jest.fn(async () => []),
  getBudgetStatus: jest.fn(async () => []),
  getGoals: jest.fn(async () => []),
}));

jest.mock('../../contexts/ThemeContext', () => {
  const { testTheme } = require('../../utils/__tests__/testTheme');
  return { useTheme: () => ({ theme: testTheme, isDark: true, toggleTheme: jest.fn() }) };
});

jest.mock('../../utils/responsive', () => {
  const { testResponsive } = require('../../utils/__tests__/testTheme');
  return { useResponsive: () => testResponsive };
});

const navigation = { navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() };

const textAnswer = (text) => ({
  intentId: 'expense_period',
  status: 'ok',
  text,
  blocks: [{ type: 'text', text }],
  suggestions: [],
  action: null,
});

const confirmAnswer = () => ({
  intentId: 'add_expense',
  status: 'pending-action',
  text: 'Quer que eu lance R$ 50,00 em Alimentação?',
  blocks: [
    { type: 'text', text: 'Quer que eu lance R$ 50,00 em Alimentação?' },
    { type: 'confirmation', question: 'Registrar despesa de R$ 50,00' },
  ],
  suggestions: [],
  action: {
    type: 'addExpense',
    label: 'Registrar despesa de R$ 50,00',
    payload: { amount: 50, category: 'Alimentação' },
    createdAt: new Date().toISOString(),
  },
});

const renderScreen = () => render(<ChatScreen navigation={navigation} route={{ params: {} }} />);

// `await render(...)` resolve antes de os efeitos assíncronos da tela
// assentarem (carregar histórico e dados da dica), então a consulta precisa ser
// a versão que espera — findBy, não getBy.
const composer = () => screen.findByLabelText('Mensagem para o assistente');

// O changeText precisa do act tanto quanto o press: sem ele o estado do
// rascunho não assenta antes do toque, e o botão dispara com a closure velha —
// `send('')`, que sai cedo sem chamar o assistente.
const ask = async (text) => {
  const input = await composer();
  await act(async () => {
    fireEvent.changeText(input, text);
  });
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Enviar mensagem'));
  });
};

// O botão de voz vive no headerRight, que o React Navigation renderiza — aqui
// não há navegador de verdade, então o elemento é pego do setOptions e tem o
// onPress chamado direto.
const pressVoiceToggle = async () => {
  const calls = navigation.setOptions.mock.calls.filter(([options]) => options.headerRight);
  const element = calls[calls.length - 1][0].headerRight();
  await act(async () => {
    element.props.onPress();
  });
};

const tab = (title) => screen.getByLabelText(`Conversa ${title}`);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('conversa', () => {
  it('abre com a apresentação do assistente e os exemplos de pergunta', async () => {
    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText(/DominusIA Gestor Financeiro/)).toBeTruthy()
    );
    expect(screen.getByText('Meu saldo')).toBeTruthy();
  });

  it('mostra a pergunta e a resposta', async () => {
    askAssistant.mockResolvedValue(textAnswer('Você gastou R$ 3.412,80.'));
    await renderScreen();

    await ask('quanto gastei esse mês?');

    // Aparece duas vezes de propósito: na bolha e no título da aba, que se
    // fixa na primeira pergunta do usuário.
    expect(screen.getAllByText('quanto gastei esse mês?').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Você gastou R$ 3.412,80.')).toBeTruthy();
  });

  it('não envia mensagem vazia', async () => {
    await renderScreen();

    fireEvent.changeText(await composer(), '   ');
    fireEvent.press(screen.getByLabelText('Enviar mensagem'));

    expect(askAssistant).not.toHaveBeenCalled();
  });

  it('persiste a conversa no armazenamento', async () => {
    askAssistant.mockResolvedValue(textAnswer('Resposta.'));
    await renderScreen();
    await ask('oi');

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('chatConversations');
      expect(raw).toContain('Resposta.');
    });
  });
});

describe('gravação com confirmação', () => {
  it('só grava depois do Confirmar', async () => {
    askAssistant.mockResolvedValue(confirmAnswer());
    runPendingAction.mockResolvedValue({ ok: true, text: 'Lancei R$ 50,00 em Alimentação.' });
    await renderScreen();

    await ask('gastei 50 no mercado');
    expect(runPendingAction).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText('Confirmar'));
    });

    expect(runPendingAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Lancei R$ 50,00 em Alimentação.')).toBeTruthy());
  });

  /**
   * O bug que este teste existe para pegar: `addTransaction` não é idempotente.
   * No aparelho é difícil reproduzir à mão, e `markBillAsPaid` — que é
   * idempotente — mascara o problema em metade dos testes manuais. Aqui os dois
   * toques caem no mesmo tick, antes de qualquer re-render.
   */
  it('dois toques rápidos no Confirmar gravam uma vez só', async () => {
    askAssistant.mockResolvedValue(confirmAnswer());

    // Promise que não resolve sozinha: segura a gravação "em curso" para o
    // segundo toque acontecer durante ela.
    let release;
    runPendingAction.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ ok: true, text: 'Lancei R$ 50,00.' });
      })
    );

    await renderScreen();
    await ask('gastei 50 no mercado');

    const button = screen.getByText('Confirmar');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
    });

    expect(runPendingAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
  });

  it('cancelar não grava e avisa que nada foi registrado', async () => {
    askAssistant.mockResolvedValue(confirmAnswer());
    await renderScreen();
    await ask('gastei 50 no mercado');

    await act(async () => {
      fireEvent.press(screen.getByText('Cancelar'));
    });

    expect(runPendingAction).not.toHaveBeenCalled();
    expect(screen.getByText('Tudo bem, não registrei nada.')).toBeTruthy();
    // Cancelado vira selo: não há mais como confirmar.
    expect(screen.queryByText('Confirmar')).toBeNull();
  });

  it('mostra o selo de erro quando a gravação falha', async () => {
    askAssistant.mockResolvedValue(confirmAnswer());
    runPendingAction.mockResolvedValue({ ok: false, text: 'Essa conta não existe mais.' });
    await renderScreen();
    await ask('paguei a conta de luz');

    await act(async () => {
      fireEvent.press(screen.getByText('Confirmar'));
    });

    await waitFor(() => expect(screen.getByText('Não deu certo')).toBeTruthy());
    expect(screen.getByText('Essa conta não existe mais.')).toBeTruthy();
  });

  // Uma confirmação recarregada do histórico chega como `expired`; mesmo que
  // algo dispare o handler, ele não pode gravar.
  it('não grava a partir de uma confirmação expirada', async () => {
    await AsyncStorage.setItem(
      'chatHistory',
      JSON.stringify({
        version: 1,
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            createdAt: '2026-09-10T12:00:00.000Z',
            blocks: [{ type: 'confirmation', question: 'Registrar despesa de R$ 50,00' }],
            suggestions: [],
            action: { type: 'addExpense', status: 'pending', payload: { amount: 50 } },
          },
        ],
      })
    );

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Confirmação expirada — peça de novo')).toBeTruthy()
    );
    expect(screen.queryByText('Confirmar')).toBeNull();
    expect(runPendingAction).not.toHaveBeenCalled();
  });
});

describe('teclado', () => {
  // Bug relatado: com edgeToEdgeEnabled (android/gradle.properties), o Android
  // não redimensiona a janela ao abrir o teclado — adjustResize do manifesto
  // não tem efeito. Sem medir a altura do teclado manualmente, o composer fica
  // embaixo da tela e o usuário não vê o que está digitando.
  //
  // Como o Platform.OS do ambiente de teste é 'ios', o ChatScreen registra
  // 'keyboardWillShow'/'keyboardWillHide'; no Android real seriam
  // 'keyboardDidShow'/'keyboardDidHide'. Captura os dois pares para o teste
  // não depender de qual plataforma o Jest está simulando.
  let handlers;

  beforeEach(() => {
    handlers = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, handler) => {
      handlers[eventName] = handler;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const composerPadding = () => {
    const composer = screen.getByTestId('chat-composer');
    return StyleSheet.flatten(composer.props.style).paddingBottom;
  };

  const emitShow = async (height) => {
    const handler = handlers.keyboardDidShow || handlers.keyboardWillShow;
    await act(async () => handler({ endCoordinates: { height } }));
  };

  const emitHide = async () => {
    const handler = handlers.keyboardDidHide || handlers.keyboardWillHide;
    await act(async () => handler());
  };

  it('com o teclado fechado, o espaço vem só da safe area', async () => {
    await renderScreen();
    // insets mockados em 0 (jest.setup.js) + r.space(8) do testResponsive.
    expect(composerPadding()).toBe(8);
  });

  // Este é o teste que teria pego o bug relatado: sem o listener, o padding
  // nunca sobe, e o composer (com o campo de texto) fica atrás do teclado.
  it('com o teclado aberto, o composer sobe o suficiente para não ficar atrás dele', async () => {
    await renderScreen();

    await emitShow(320);

    expect(composerPadding()).toBe(320);
  });

  it('usa o maior dos dois valores, não a soma — senão sobra espaço em branco', async () => {
    await renderScreen();

    // Teclado mais baixo que a safe area (caso extremo, pouco comum, mas o
    // Math.max tem que se comportar bem mesmo assim).
    await emitShow(3);

    expect(composerPadding()).toBe(8);
  });

  it('ao fechar o teclado, volta para o padding da safe area', async () => {
    await renderScreen();

    await emitShow(320);
    expect(composerPadding()).toBe(320);

    await emitHide();
    expect(composerPadding()).toBe(8);
  });

  it('o campo de texto continua na árvore e digitável com o teclado aberto', async () => {
    await renderScreen();
    await emitShow(320);

    const input = await composer();
    await act(async () => {
      fireEvent.changeText(input, 'gastei 50 no mercado');
    });

    expect(screen.getByLabelText('Mensagem para o assistente').props.value).toBe(
      'gastei 50 no mercado'
    );
  });
});

describe('abas de conversa', () => {
  it('abre com uma aba só, ainda sem título de pergunta', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('chat-new-tab')).toBeTruthy());
    expect(screen.getByText('Nova conversa')).toBeTruthy();
  });

  it('criar uma aba nova começa outra conversa, com a apresentação de novo', async () => {
    askAssistant.mockResolvedValue(textAnswer('Primeira resposta.'));
    await renderScreen();
    await ask('pergunta da primeira aba');

    expect(screen.getByText('Primeira resposta.')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('chat-new-tab'));
    });

    // A conversa anterior sai da tela, mas continua existindo como aba.
    expect(screen.queryByText('Primeira resposta.')).toBeNull();
    expect(screen.getByText(/DominusIA Gestor Financeiro/)).toBeTruthy();
    expect(screen.getAllByText('pergunta da primeira aba').length).toBeGreaterThanOrEqual(1);
  });

  it('voltar para a aba anterior traz a conversa dela de volta', async () => {
    askAssistant.mockResolvedValue(textAnswer('Resposta da primeira.'));
    await renderScreen();
    await ask('primeira pergunta');

    await act(async () => {
      fireEvent.press(screen.getByTestId('chat-new-tab'));
    });
    expect(screen.queryByText('Resposta da primeira.')).toBeNull();

    await act(async () => {
      fireEvent.press(tab('primeira pergunta'));
    });
    expect(screen.getByText('Resposta da primeira.')).toBeTruthy();
  });

  it('toque longo numa aba pede confirmação antes de excluir', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await act(async () => {
      fireEvent(tab('Nova conversa'), 'longPress');
    });

    expect(alert).toHaveBeenCalled();
    expect(alert.mock.calls[0][0]).toBe('Excluir conversa');
  });

  // Sem nenhuma aba não haveria onde digitar nem o que mostrar.
  it('excluir a última aba deixa uma conversa nova no lugar', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      buttons.find((button) => button.style === 'destructive').onPress();
    });

    askAssistant.mockResolvedValue(textAnswer('Vai sumir.'));
    await renderScreen();
    await ask('pergunta que sera apagada');

    await act(async () => {
      fireEvent(tab('pergunta que sera apagada'), 'longPress');
    });

    expect(screen.queryByText('Vai sumir.')).toBeNull();
    expect(screen.getByText(/DominusIA Gestor Financeiro/)).toBeTruthy();
    expect(screen.getByTestId('chat-new-tab')).toBeTruthy();
  });
});

describe('voz', () => {
  it('vem desligada: a resposta não é falada', async () => {
    askAssistant.mockResolvedValue(textAnswer('Você gastou R$ 100,00.'));
    await renderScreen();
    await ask('quanto gastei?');

    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('ligada, fala a resposta assim que ela chega', async () => {
    askAssistant.mockResolvedValue(textAnswer('Você gastou R$ 100,00.'));
    await renderScreen();

    await pressVoiceToggle();
    await ask('quanto gastei?');

    expect(Speech.speak).toHaveBeenCalledTimes(1);
    // Sem o "R$", que o TTS soletraria.
    expect(Speech.speak.mock.calls[0][0]).toBe('Você gastou 100,00.');
  });

  it('a preferência de voz fica salva', async () => {
    await renderScreen();

    await pressVoiceToggle();

    await waitFor(async () => {
      expect(await AsyncStorage.getItem('chatVoiceEnabled')).toBe('true');
    });
  });

  it('dá para ouvir uma resposta pelo botão, mesmo com a voz desligada', async () => {
    askAssistant.mockResolvedValue(textAnswer('Seu saldo é R$ 2.220,00.'));
    await renderScreen();
    await ask('meu saldo');

    const bubbles = screen.getAllByLabelText('Ouvir esta resposta');
    await act(async () => {
      fireEvent.press(bubbles[bubbles.length - 1]);
    });

    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak.mock.calls[0][0]).toBe('Seu saldo é 2.220,00.');
  });

  it('sair da tela cala a voz', async () => {
    const view = await renderScreen();
    await act(async () => {
      view.unmount();
    });

    expect(Speech.stop).toHaveBeenCalled();
  });
});

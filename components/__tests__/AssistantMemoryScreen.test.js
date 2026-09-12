import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import AssistantMemoryScreen from '../AssistantMemoryScreen';

const memory = { phrases: [], intentUses: {} };

jest.mock('../../utils/assistant', () => ({
  hydrateMemory: jest.fn(async () => true),
  getMemory: jest.fn(() => memory),
  unlearnPhrase: jest.fn(async () => true),
  forgetEverything: jest.fn(async () => true),
}));

jest.mock('../../utils/assistant/memory', () => ({
  trainCategoryModel: jest.fn(() => ({ ready: false })),
}));

jest.mock('../../database/database', () => ({
  getTransactions: jest.fn(async () => []),
}));

jest.mock('../../contexts/ThemeContext', () => {
  const { testTheme } = require('../../utils/__tests__/testTheme');
  return { useTheme: () => ({ theme: testTheme, isDark: true, toggleTheme: jest.fn() }) };
});

jest.mock('../../utils/responsive', () => {
  const { testResponsive } = require('../../utils/__tests__/testTheme');
  return { useResponsive: () => testResponsive };
});

const { getMemory, unlearnPhrase, forgetEverything } = require('../../utils/assistant');
const { trainCategoryModel } = require('../../utils/assistant/memory');

const setMemory = (next) => {
  memory.phrases = next.phrases || [];
  memory.intentUses = next.intentUses || {};
};

/**
 * No Testing Library 14 o `render` é assíncrono e as queries vivem no `screen`
 * — sem o await, toda query falha com "render function has not been called".
 *
 * E mesmo depois do await a tela ainda está carregando: ela lê a memória e
 * treina o modelo de categoria antes de trocar o ActivityIndicator pelo
 * conteúdo. Por isso a primeira consulta de cada teste é `findBy`, que espera.
 */
const renderScreen = () => render(<AssistantMemoryScreen />);

beforeEach(() => {
  jest.clearAllMocks();
  setMemory({});
  getMemory.mockImplementation(() => memory);
  trainCategoryModel.mockImplementation(() => ({ ready: false }));
});

describe('tela vazia', () => {
  it('diz que nada foi ensinado em vez de mostrar lista vazia', async () => {
    await renderScreen();

    expect(await screen.findByText('Nada ensinado ainda.')).toBeTruthy();
    expect(screen.getByText('Ainda sem histórico de perguntas.')).toBeTruthy();
  });
});

describe('com aprendizado', () => {
  beforeEach(() => {
    setMemory({
      phrases: [
        { text: 'to no sufoco', intentId: 'leftover_after_bills', count: 3, updatedAt: '2026-09-01' },
        { text: 'manda o veredito', intentId: 'period_summary', count: 1, updatedAt: '2026-09-02' },
      ],
      intentUses: { expense_period: 7, bills_due: 2 },
    });
  });

  it('mostra a frase com o nome da intenção em português, não com o id', async () => {
    await renderScreen();

    expect(await screen.findByText('to no sufoco')).toBeTruthy();
    expect(screen.getByText(/Quanto sobra/)).toBeTruthy();
    expect(screen.queryByText(/leftover_after_bills/)).toBeNull();
  });

  it('mostra a contagem só quando a frase foi usada mais de uma vez', async () => {
    await renderScreen();

    expect(await screen.findByText(/usada 3x/)).toBeTruthy();
    expect(screen.queryByText(/usada 1x/)).toBeNull();
  });

  it('lista o que mais se pergunta, do maior para o menor', async () => {
    await renderScreen();

    expect(await screen.findByText('7x')).toBeTruthy();
    expect(screen.getByText('Quanto gastei')).toBeTruthy();
    expect(screen.getByText('Contas a vencer')).toBeTruthy();
  });

  // Esquecer é destrutivo e irreversível: não pode acontecer no primeiro toque.
  it('pede confirmação antes de esquecer uma frase', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    fireEvent.press(await screen.findByLabelText('Esquecer a frase to no sufoco'));

    expect(spy).toHaveBeenCalled();
    expect(unlearnPhrase).not.toHaveBeenCalled();

    // Executa o botão destrutivo do diálogo.
    const destructive = spy.mock.calls[0][2].find((button) => button.style === 'destructive');
    await destructive.onPress();
    expect(unlearnPhrase).toHaveBeenCalledWith('to no sufoco');

    spy.mockRestore();
  });

  it('pede confirmação antes de esquecer tudo', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    fireEvent.press(await screen.findByText('Esquecer tudo'));

    expect(forgetEverything).not.toHaveBeenCalled();
    const destructive = spy.mock.calls[0][2].find((button) => button.style === 'destructive');
    await destructive.onPress();
    expect(forgetEverything).toHaveBeenCalled();

    spy.mockRestore();
  });
});

describe('aprendizado de categoria', () => {
  it('avisa que ainda falta histórico', async () => {
    await renderScreen();

    expect(await screen.findByText(/Ainda faltam lançamentos/)).toBeTruthy();
  });

  it('confirma quando o histórico já dá base', async () => {
    trainCategoryModel.mockImplementation(() => ({ ready: true }));
    await renderScreen();

    expect(await screen.findByText(/já dão base/)).toBeTruthy();
  });
});

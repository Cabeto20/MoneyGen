import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ChatBubble, { createBubbleStyles, plainText } from '../ChatBubble';
import { testTheme, testResponsive } from '../../utils/__tests__/testTheme';

/**
 * Atenção ao formato destes testes: no Testing Library 14 o `render` é
 * assíncrono e não devolve mais as queries — elas vivem só no `screen`, que só
 * fica populado depois do await. Sem o await, toda query falha com
 * "render function has not been called".
 */

const styles = createBubbleStyles(testTheme, testResponsive);

const renderBubble = (message, handlers = {}) =>
  render(
    <ChatBubble
      message={message}
      theme={testTheme}
      r={testResponsive}
      styles={styles}
      showAvatar
      announce={false}
      onSuggestion={handlers.onSuggestion || jest.fn()}
      onConfirm={handlers.onConfirm || jest.fn()}
      onCancel={handlers.onCancel || jest.fn()}
    />
  );

const assistantWith = (blocks, action = null) => ({
  id: 'm1',
  role: 'assistant',
  createdAt: '2026-09-10T12:00:00.000Z',
  blocks,
  suggestions: [],
  action,
});

describe('blocos', () => {
  it('mostra texto', async () => {
    await renderBubble(assistantWith([{ type: 'text', text: 'Você gastou R$ 100,00.' }]));
    expect(screen.getByText('Você gastou R$ 100,00.')).toBeTruthy();
  });

  it('formata o bloco de valor como moeda', async () => {
    await renderBubble(
      assistantWith([{ type: 'value', label: 'Saldo', value: 1234.5, tone: 'positivo' }])
    );
    expect(screen.getByText('Saldo')).toBeTruthy();
    expect(screen.getByText(/1\.234,50/)).toBeTruthy();
  });

  it('avisa quantos itens ficaram de fora da lista', async () => {
    await renderBubble(
      assistantWith([{ type: 'list', items: [{ id: 'a', title: 'Energia', value: 210 }], total: 9 }])
    );
    expect(screen.getByText('e mais 8…')).toBeTruthy();
  });

  // Histórico gravado por uma versão futura não pode derrubar a tela.
  it('ignora bloco de tipo desconhecido sem quebrar', async () => {
    await renderBubble(
      assistantWith([{ type: 'graficoDoFuturo', data: [] }, { type: 'text', text: 'ok' }])
    );
    expect(screen.getByText('ok')).toBeTruthy();
  });

  it('dispara a pergunta do chip', async () => {
    const onSuggestion = jest.fn();
    await renderBubble(
      assistantWith([
        { type: 'actions', options: [{ id: 'a', label: 'Meu saldo', sends: 'quanto tenho?' }] },
      ]),
      { onSuggestion }
    );

    fireEvent.press(screen.getByText('Meu saldo'));
    expect(onSuggestion).toHaveBeenCalledWith('quanto tenho?');
  });
});

describe('confirmação de gravação', () => {
  const confirmationBlocks = [
    { type: 'text', text: 'Quer que eu lance R$ 50,00?' },
    { type: 'confirmation', question: 'Registrar despesa de R$ 50,00' },
  ];

  it('mostra os botões enquanto está pendente', async () => {
    await renderBubble(assistantWith(confirmationBlocks, { type: 'addExpense', status: 'pending' }));
    expect(screen.getByText('Confirmar')).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });

  it('não deixa confirmar de novo enquanto a gravação está em curso', async () => {
    const onConfirm = jest.fn();
    await renderBubble(assistantWith(confirmationBlocks, { type: 'addExpense', status: 'running' }), {
      onConfirm,
    });

    // O rótulo some: durante a gravação o botão vira spinner.
    expect(screen.queryByText('Confirmar')).toBeNull();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Garantia central: sem botão na árvore não existe caminho para reconfirmar,
  // nem por duplo toque nem pelo leitor de tela.
  it.each([
    ['done', 'Registrado'],
    ['cancelled', 'Cancelado'],
    ['expired', 'Confirmação expirada — peça de novo'],
    ['error', 'Não deu certo'],
  ])('substitui os botões pelo selo quando o status é %s', async (status, label) => {
    await renderBubble(assistantWith(confirmationBlocks, { type: 'addExpense', status }));

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText('Confirmar')).toBeNull();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });
});

describe('leitor de tela', () => {
  it('lê a bolha inteira como uma unidade, dizendo quem falou', async () => {
    await renderBubble(
      assistantWith([
        { type: 'text', text: 'Seu saldo é positivo.' },
        { type: 'value', label: 'Saldo', value: 100, tone: 'positivo' },
      ])
    );

    expect(screen.getByLabelText(/^Assistente: Seu saldo é positivo\./)).toBeTruthy();
  });

  it('identifica a fala do usuário', async () => {
    await renderBubble({
      id: 'u1',
      role: 'user',
      createdAt: '2026-09-10T12:00:00.000Z',
      blocks: [{ type: 'text', text: 'quanto gastei?' }],
      suggestions: [],
      action: null,
    });

    expect(screen.getByLabelText('Você: quanto gastei?')).toBeTruthy();
  });

  it('plainText junta os blocos numa frase', () => {
    const text = plainText([
      { type: 'text', text: 'Faltam 3 contas.' },
      { type: 'value', label: 'Em aberto', value: 890, tone: 'alerta' },
    ]);

    expect(text).toContain('Faltam 3 contas.');
    expect(text).toContain('Em aberto');
  });
});

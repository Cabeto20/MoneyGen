import { pickTip } from '../chatTips';

const NOW = new Date(2026, 8, 10, 14, 0, 0);

const bill = (overrides = {}) => ({
  id: 'b1',
  description: 'Energia',
  amount: 210,
  dueDay: 12,
  category: 'Energia',
  billType: 'fixa',
  paidMonths: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const state = (overrides = {}) => ({
  balance: { income: 0, expense: 0, balance: 1000 },
  bills: [],
  budgets: [],
  goals: [],
  ...overrides,
});

describe('dica do momento', () => {
  it('cai no convite genérico quando não há nada a sinalizar', () => {
    const tip = pickTip(state(), NOW);
    expect(tip.id).toBe('fallback');
    expect(tip.question).toBeTruthy();
  });

  it('não quebra sem argumento nenhum', () => {
    expect(pickTip(undefined, NOW).id).toBe('fallback');
  });

  it('orçamento estourado vence tudo', () => {
    const tip = pickTip(
      state({
        budgets: [{ category: 'Lazer', status: 'exceeded', limit: 400, spent: 620 }],
        bills: [bill()],
        balance: { balance: -50 },
        goals: [{ id: 'g', name: 'Viagem', targetAmount: 100, savedAmount: 90 }],
      }),
      NOW
    );

    expect(tip.id).toBe('budget');
    expect(tip.text).toContain('Lazer');
    expect(tip.question).toContain('Lazer');
  });

  it('conta vencendo vence saldo negativo e meta', () => {
    const tip = pickTip(
      state({
        bills: [bill({ dueDay: 12 })],
        balance: { balance: -50 },
        goals: [{ id: 'g', name: 'Viagem', targetAmount: 100, savedAmount: 90 }],
      }),
      NOW
    );

    expect(tip.id).toBe('bill');
    expect(tip.text).toContain('Energia');
  });

  it('ignora conta já quitada na competência', () => {
    const tip = pickTip(state({ bills: [bill({ paidMonths: ['2026-09'] })] }), NOW);
    expect(tip.id).toBe('fallback');
  });

  it('ignora conta que vence longe', () => {
    const tip = pickTip(state({ bills: [bill({ dueDay: 28 })] }), NOW);
    expect(tip.id).toBe('fallback');
  });

  it('avisa saldo negativo', () => {
    const tip = pickTip(state({ balance: { balance: -120.5 } }), NOW);
    expect(tip.id).toBe('balance');
    expect(tip.text).toContain('120,50');
  });

  it('escolhe a meta mais próxima do alvo', () => {
    const tip = pickTip(
      state({
        goals: [
          { id: 'a', name: 'Longe', targetAmount: 1000, savedAmount: 100 },
          { id: 'b', name: 'Perto', targetAmount: 1000, savedAmount: 900 },
        ],
      }),
      NOW
    );

    expect(tip.id).toBe('goal');
    expect(tip.text).toContain('Perto');
  });

  it('ignora meta já concluída', () => {
    const tip = pickTip(
      state({ goals: [{ id: 'a', name: 'Feita', targetAmount: 100, savedAmount: 100 }] }),
      NOW
    );
    expect(tip.id).toBe('fallback');
  });

  // A dica alimenta um card que rerenderiza a cada foco da Home. Se ela
  // sorteasse, o usuário veria um conselho diferente a cada volta e pararia de
  // confiar nos números.
  it('é determinística: mesma entrada, mesma dica', () => {
    const input = state({ bills: [bill({ dueDay: 11 }), bill({ id: 'b2', description: 'Internet', dueDay: 12 })] });
    const first = pickTip(input, NOW);

    for (let i = 0; i < 20; i += 1) {
      expect(pickTip(input, NOW)).toEqual(first);
    }
  });
});

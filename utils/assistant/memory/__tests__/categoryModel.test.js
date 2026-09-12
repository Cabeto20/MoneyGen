import { trainCategoryModel } from '../categoryModel';
import { extractCategory } from '../../entities/category';

const tx = (description, category, type = 'expense') => ({ description, category, type });

/**
 * Histórico com vocabulário que a tabela estática não conhece — e, no caso da
 * barbearia, com uma escolha que só este usuário faria. É esse o ponto: nenhuma
 * lista fixa vai adivinhar que, para ele, barbearia é Saúde.
 */
const historico = [
  tx('quitanda do seu joao', 'Alimentação'),
  tx('quitanda da esquina', 'Alimentação'),
  tx('quitanda do joao feira', 'Alimentação'),
  tx('barbearia do tonho', 'Saúde'),
  tx('barbearia tonho corte', 'Saúde'),
  tx('barbearia do tonho barba', 'Saúde'),
  tx('salao da dona rita', 'Saúde'),
  tx('bilhete unico recarga', 'Transporte'),
  tx('bilhete unico', 'Transporte'),
  tx('recarga bilhete metro', 'Transporte'),
  tx('van do bairro', 'Transporte'),
  tx('van escolar bairro', 'Transporte'),
];

describe('trainCategoryModel', () => {
  it('aprende nome próprio que nenhuma tabela estática teria', () => {
    const model = trainCategoryModel(historico);
    expect(model.ready).toBe(true);
    expect(model.predict('quitanda do seu joao').category).toBe('Alimentação');
    expect(model.predict('barbearia do tonho').category).toBe('Saúde');
    expect(model.predict('bilhete unico').category).toBe('Transporte');
  });

  it('generaliza para combinação que nunca viu junta', () => {
    const model = trainCategoryModel(historico);
    expect(model.predict('recarga do bilhete').category).toBe('Transporte');
  });

  // Sem nenhuma palavra conhecida o resultado seria só a categoria mais
  // frequente, dita com cara de palpite informado.
  it('devolve null quando não reconhece nenhuma palavra', () => {
    const model = trainCategoryModel(historico);
    expect(model.predict('xyz abc qwerty')).toBeNull();
  });

  it('não fica pronto com histórico curto', () => {
    const model = trainCategoryModel(historico.slice(0, 5));
    expect(model.ready).toBe(false);
    expect(model.predict('quitanda do seu joao')).toBeNull();
  });

  it('não fica pronto quando só existe uma categoria', () => {
    const model = trainCategoryModel(
      Array.from({ length: 20 }, (_, i) => tx(`quitanda ${i}`, 'Alimentação'))
    );
    expect(model.ready).toBe(false);
  });

  it('ignora lançamento sem descrição ou sem categoria', () => {
    const model = trainCategoryModel([...historico, tx('', 'Lazer'), tx('algo', '')]);
    expect(model.predict('algo')).toBeNull();
  });

  // Despesa e receita têm categorias que não se misturam: um modelo único
  // gastaria massa de probabilidade com classes impossíveis.
  it('separa despesa de receita', () => {
    const model = trainCategoryModel([
      ...historico,
      ...Array.from({ length: 6 }, (_, i) => tx(`freela site ${i}`, 'Freelance', 'income')),
      ...Array.from({ length: 6 }, (_, i) => tx(`aluguel loja ${i}`, 'Aluguel Recebido', 'income')),
    ]);

    expect(model.predict('freela site', 'income').category).toBe('Freelance');
    expect(model.predict('quitanda do seu joao', 'income')).toBeNull();
  });

  it('não explode com lista vazia', () => {
    const model = trainCategoryModel([]);
    expect(model.ready).toBe(false);
    expect(model.predict('qualquer coisa')).toBeNull();
  });
});

describe('extractCategory com o modelo aprendido', () => {
  const model = trainCategoryModel(historico);

  // 'padaria' a tabela estática já conhece; 'barbearia do tonho' e 'bilhete
  // unico' não — caem em 'Serviços' sem confiança. É exatamente esse buraco
  // que o histórico do usuário preenche.
  it('usa o histórico onde a tabela estática não tem palpite', () => {
    const semModelo = extractCategory('gastei 20 na barbearia do tonho');
    const comModelo = extractCategory('gastei 20 na barbearia do tonho', 'expense', model);

    expect(semModelo.confident).toBe(false);
    expect(comModelo.value).toBe('Saúde');
    expect(comModelo.confident).toBe(true);
    expect(comModelo.learned).toBe(true);
  });

  it('aprende o vocabulário de transporte do usuário', () => {
    const comModelo = extractCategory('paguei o bilhete unico', 'expense', model);
    expect(comModelo.value).toBe('Transporte');
    expect(comModelo.learned).toBe(true);
  });

  // O modelo entra por último: onde a tabela estática já sabe, ela continua
  // mandando, senão um histórico torto reescreveria o que é certo por definição.
  it('não passa na frente do casamento literal', () => {
    const found = extractCategory('quanto gastei com transporte', 'expense', model);
    expect(found.value).toBe('Transporte');
    expect(found.learned).toBeUndefined();
  });

  it('continua funcionando sem modelo nenhum', () => {
    expect(() => extractCategory('gastei 20 na barbearia do tonho', 'expense', null)).not.toThrow();
  });
});

import commands from './commands';
import calculators from './calculators';
import goals from './goals';
import budgets from './budgets';
import bills from './bills';
import comparisons from './comparisons';
import queries from './queries';
import insights from './insights';
import help from './help';

/**
 * Registro ordenado das intenções.
 *
 * A ordem é o último critério de desempate no resolvedor, então mexer nela
 * muda comportamento: o mais específico vem primeiro, e as consultas amplas
 * (`queries`) ficam depois de quem exige entidade própria.
 */
export const INTENTS = [
  ...commands,
  ...calculators,
  ...goals,
  ...budgets,
  ...bills,
  ...comparisons,
  ...queries,
  ...insights,
  ...help,
];

export const INTENT_BY_ID = INTENTS.reduce((map, intent) => {
  map[intent.id] = intent;
  return map;
}, {});

import { savingsPlan } from '../../projections';
import { formatDateBR } from '../../dateHelpers';
import { ok, noData, textBlock, valueBlock, listBlock } from '../result';
import { money, percent, count, NO_DATA, capitalize } from '../replies';
import { SUGGESTIONS } from '../suggestions';

const progressOf = (goal) => ({
  ...goal,
  missing: Math.max(0, goal.targetAmount - goal.savedAmount),
  ratio: goal.targetAmount > 0 ? goal.savedAmount / goal.targetAmount : 0,
});

export const goalProgress = {
  id: 'goal_progress',
  priority: 2,
  patterns: [
    /\b(?:minhas?|as) metas?\b/,
    /\bquanto falta (?:pra|para)\b/,
    /\bcomo (?:esta|estao|vai|vao) (?:a|as|minha|minhas) metas?\b/,
    /\bprogresso d[ao] metas?\b/,
    /\bmeta\b/,
  ],
  keywordGroups: [['meta', 'metas', 'objetivo', 'objetivos', 'guardar para']],
  requiredGroups: [0],
  optional: ['goal'],
  run: async (entities, snapshot) => {
    const goals = await snapshot.goals();
    if (goals.length === 0) return noData('goal_progress', NO_DATA.goals);

    if (entities.goal) {
      const goal = progressOf(goals.find((item) => item.id === entities.goal.id) || entities.goal);
      const deadline = goal.deadline ? `, com prazo em ${formatDateBR(goal.deadline)}` : '';
      const text =
        goal.missing === 0
          ? `A meta ${goal.name} já foi batida: ${money(goal.savedAmount)} de ${money(goal.targetAmount)}.`
          : `${capitalize(goal.name)}: ${money(goal.savedAmount)} de ${money(goal.targetAmount)} (${percent(goal.ratio)}). Faltam ${money(goal.missing)}${deadline}.`;

      return ok('goal_progress', text, {
        blocks: [textBlock(text), valueBlock(`Falta para ${goal.name}`, goal.missing, 'neutro')],
        data: goal,
        suggestions: [SUGGESTIONS.goals, SUGGESTIONS.leftover],
      });
    }

    const all = goals.map(progressOf);
    const open = all.filter((goal) => goal.missing > 0);
    const done = all.length - open.length;

    const totalSaved = all.reduce((sum, goal) => sum + goal.savedAmount, 0);
    const totalTarget = all.reduce((sum, goal) => sum + goal.targetAmount, 0);

    const parts = [
      `Você tem ${count(all.length, 'meta', 'metas')}, com ${money(totalSaved)} guardados de ${money(totalTarget)}.`,
    ];
    if (done > 0) parts.push(`${count(done, 'já foi batida', 'já foram batidas')}.`);
    if (open.length > 0) {
      const closest = open.reduce((a, b) => (a.ratio > b.ratio ? a : b));
      parts.push(`A mais perto é ${closest.name}, com ${percent(closest.ratio)} — faltam ${money(closest.missing)}.`);
    }

    const text = parts.join(' ');

    return ok('goal_progress', text, {
      blocks: [
        textBlock(text),
        listBlock(
          all.map((goal) => ({
            id: goal.id,
            title: goal.name,
            subtitle: `${money(goal.savedAmount)} de ${money(goal.targetAmount)} · ${percent(goal.ratio)}`,
            value: goal.missing,
            tone: goal.missing === 0 ? 'positivo' : 'neutro',
          }))
        ),
      ],
      data: { goals: all, totalSaved, totalTarget },
      suggestions: [SUGGESTIONS.leftover, SUGGESTIONS.monthSummary],
    });
  },
};

export const goalMonthlySaving = {
  id: 'goal_monthly_saving',
  priority: 3,
  patterns: [
    /\bquanto (?:preciso|tenho que|devo) guardar\b/,
    /\bquanto (?:por mes|mensal)[^.]{0,20}(?:meta|guardar)\b/,
    /\bpra (?:bater|atingir|alcancar) (?:a )?meta\b/,
    /\bguardar por mes\b/,
  ],
  keywordGroups: [['guardar', 'poupar', 'bater a meta', 'atingir', 'alcancar']],
  requiredGroups: [0],
  optional: ['goal', 'period'],
  run: async (entities, snapshot) => {
    const goals = await snapshot.goals();
    if (goals.length === 0) return noData('goal_monthly_saving', NO_DATA.goals);

    const open = goals.filter((goal) => goal.savedAmount < goal.targetAmount);
    const goal = entities.goal
      ? goals.find((item) => item.id === entities.goal.id)
      : open[0] || goals[0];

    if (!goal) return noData('goal_monthly_saving', NO_DATA.goals);

    // Prazo citado na pergunta ("até dezembro") tem precedência sobre o prazo
    // cadastrado: o usuário está simulando outro cenário.
    const deadline =
      entities.period && entities.period.kind === 'month' ? entities.period.end : goal.deadline;

    const plan = savingsPlan({
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline,
      now: snapshot.now,
    });

    if (plan.missing === 0) {
      return ok('goal_monthly_saving', `A meta ${goal.name} já está completa — não precisa guardar mais nada.`, {
        data: { goal, plan },
        suggestions: [SUGGESTIONS.goals],
      });
    }

    if (plan.monthlyNeeded === null) {
      const text = `Faltam ${money(plan.missing)} para a meta ${goal.name}, mas ela não tem prazo definido. Me diga até quando (por exemplo, "até dezembro") que eu calculo o valor por mês.`;
      return ok('goal_monthly_saving', text, {
        data: { goal, plan },
        suggestions: [SUGGESTIONS.goals],
      });
    }

    const window = plan.overdue
      ? 'O prazo já chegou, então isso precisaria sair de uma vez'
      : `Em ${count(Math.max(1, plan.monthsLeft), 'mês', 'meses')}, dá`;
    const text = `Faltam ${money(plan.missing)} para ${goal.name}. ${window} ${money(plan.monthlyNeeded)} por mês.`;

    return ok('goal_monthly_saving', text, {
      blocks: [textBlock(text), valueBlock('Por mês', plan.monthlyNeeded, 'neutro')],
      data: { goal, plan },
      suggestions: [SUGGESTIONS.leftover, SUGGESTIONS.goals],
    });
  },
};

export default [goalProgress, goalMonthlySaving];

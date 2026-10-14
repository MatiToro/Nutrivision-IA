const prisma = require('../config/prisma');
const { calculateDailyGoals } = require('./nutrition.service');

// Campos de objetivo/metas que se registran en GoalChangeLog.
const GOAL_FIELDS = ['goal', 'dailyCalorieGoal', 'dailyProteinGoalG', 'dailyCarbsGoalG', 'dailyFatGoalG'];

function diffGoals(before, after) {
  const changes = {};
  for (const field of GOAL_FIELDS) {
    if (before[field] !== after[field]) changes[field] = { from: before[field], to: after[field] };
  }
  return changes;
}

/**
 * Cambia el objetivo y/o las metas diarias de un usuario, con las mismas reglas
 * que cuando lo hace el propio usuario desde su perfil:
 * - Si cambia el objetivo, las metas se recalculan solas
 *   y el gráfico de peso arranca de nuevo desde el peso actual.
 * - Las metas cargadas a mano pisan lo recalculado.
 * Registra quién hizo el cambio y, si `notify`, deja el aviso único pendiente.
 */
async function applyGoalUpdate(target, input, { changedById, notify = false }) {
  const { goal, dailyCalorieGoal, dailyProteinGoalG, dailyCarbsGoalG, dailyFatGoalG } = input;
  const goalChanged = goal !== undefined && goal !== target.goal;

  let recalculated = {};
  const canCalculate = target.weightKg && target.heightCm && target.age && target.sex;
  if (goalChanged && canCalculate) {
    recalculated = calculateDailyGoals({
      weightKg: target.weightKg,
      heightCm: target.heightCm,
      age: target.age,
      sex: target.sex,
      activityLevel: target.activityLevel,
      goal,
    });
  }

  const data = {
    ...(goal !== undefined && { goal }),
    ...recalculated,
    ...(dailyCalorieGoal !== undefined && { dailyCalorieGoal }),
    ...(dailyProteinGoalG !== undefined && { dailyProteinGoalG }),
    ...(dailyCarbsGoalG !== undefined && { dailyCarbsGoalG }),
    ...(dailyFatGoalG !== undefined && { dailyFatGoalG }),
  };

  const preview = { ...target, ...data };
  const changes = diffGoals(target, preview);
  if (!Object.keys(changes).length) return { user: target, changes };

  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...data,
      ...(notify && { goalsNoticePending: true }),
      // Nueva etapa: el gráfico de progreso arranca de cero.
      ...(goalChanged && { goalStartedAt: new Date() }),
    },
  });

  await prisma.goalChangeLog.create({ data: { userId: target.id, changedById, changes } });

  if (goalChanged) {
    await prisma.weightLog.deleteMany({ where: { userId: target.id } });
    if (user.weightKg != null) {
      await prisma.weightLog.create({ data: { userId: target.id, weightKg: user.weightKg } });
    }
  }

  return { user, changes };
}

module.exports = { applyGoalUpdate, diffGoals, GOAL_FIELDS };

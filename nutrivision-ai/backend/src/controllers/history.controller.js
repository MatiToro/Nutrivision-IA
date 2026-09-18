const prisma = require('../config/prisma');

// GET /api/history/meals?from=&to=
async function listMeals(req, res) {
  const { from, to } = req.query;

  const meals = await prisma.meal.findMany({
    where: {
      userId: req.user.id,
      ...(from || to
        ? {
          loggedAt: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }
        : {}),
    },
    include: { ingredients: true, coachFeedback: true },
    orderBy: { loggedAt: 'desc' },
  });

  res.json({ meals });
}

// GET /api/history/summary
// Progreso diario: consumo del día actual vs meta, evolución de peso,
// y racha de días consecutivos escaneando al menos un plato.
async function getSummary(req, res) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayMeals, weightLogs, allMealDates] = await Promise.all([
    prisma.meal.findMany({
      where: { userId: req.user.id, loggedAt: { gte: startOfDay } },
    }),
    prisma.weightLog.findMany({
      where: { userId: req.user.id },
      orderBy: { loggedAt: 'asc' },
      take: 90,
    }),
    // Solo traemos la fecha, no el registro completo — es liviano incluso
    // con muchos platos acumulados, porque la racha necesita el
    // historial completo de días (no solo la última semana).
    prisma.meal.findMany({
      where: { userId: req.user.id },
      select: { loggedAt: true },
    }),
  ]);

  const todayTotals = todayMeals.reduce((acc, m) => ({
    calories: acc.calories + (m.totalCalories || 0),
    proteinG: acc.proteinG + (m.totalProteinG || 0),
    carbsG: acc.carbsG + (m.totalCarbsG || 0),
    fatG: acc.fatG + (m.totalFatG || 0),
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  const mealDateKeys = new Set(allMealDates.map((m) => toDateKey(new Date(m.loggedAt))));
  const streak = calculateStreak(mealDateKeys);

  res.json({
    today: {
      totals: todayTotals,
      goal: {
        calories: req.user.dailyCalorieGoal,
        proteinG: req.user.dailyProteinGoalG,
        carbsG: req.user.dailyCarbsGoalG,
        fatG: req.user.dailyFatGoalG,
      },
      mealsLogged: todayMeals.length,
    },
    weightHistory: weightLogs,
    streak,
  });
}

// Clave de día local ("2026-8-30") — usa el mismo criterio de "día"
// que el resto de la app (fecha de calendario, no UTC), para que la
// racha coincida con lo que el usuario ve agrupado en su Historial.
function toDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Cuenta días consecutivos con al menos un plato registrado, terminando
// hoy o ayer. Si ni hoy ni ayer tienen un plato, la racha está cortada (0).
// Dejamos "ayer" como válido para no resetear la racha a mitad del día
// de hoy, antes de que el usuario haya tenido chance de escanear algo.
function calculateStreak(mealDateKeys) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  let cursor;
  if (mealDateKeys.has(toDateKey(today))) {
    cursor = today;
  } else if (mealDateKeys.has(toDateKey(yesterday))) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (mealDateKeys.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

module.exports = { listMeals, getSummary };

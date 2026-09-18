const prisma = require('../config/prisma');
const { calculateDailyGoals } = require('../services/nutrition.service');

// GET /api/users/me
async function getProfile(req, res) {
  res.json({ user: req.user });
}

// PUT /api/users/me/onboarding
// Formulario inicial: carga de datos biométricos y meta calórica.
async function completeOnboarding(req, res) {
  const { weightKg, heightCm, age, sex, activityLevel, goal } = req.body;

  const goals = calculateDailyGoals({ weightKg, heightCm, age, sex, activityLevel, goal });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      weightKg,
      heightCm,
      age,
      sex,
      activityLevel,
      goal,
      onboardingCompleted: true,
      ...goals,
    },
  });

  // El alta de objetivos también deja el primer registro en el
  // historial de peso, para que el gráfico de progreso tenga punto de partida.
  await prisma.weightLog.create({
    data: { userId: user.id, weightKg },
  });

  res.json({ user });
}

// PATCH /api/users/me
// Permite editar el perfil / recalcular metas si cambian los datos
// biométricos, o personalizar directamente las metas de macros.
async function updateProfile(req, res) {
  const {
    weightKg, heightCm, age, sex, activityLevel, goal, displayName,
    dailyCalorieGoal, dailyProteinGoalG, dailyCarbsGoalG, dailyFatGoalG,
  } = req.body;

  const goalChanged = goal !== undefined && goal !== req.user.goal;

  const shouldRecalculate = [weightKg, heightCm, age, sex, activityLevel, goal].some(
    (v) => v !== undefined,
  );

  let recalculatedGoals = {};
  if (shouldRecalculate) {
    const current = req.user;
    recalculatedGoals = calculateDailyGoals({
      weightKg: weightKg ?? current.weightKg,
      heightCm: heightCm ?? current.heightCm,
      age: age ?? current.age,
      sex: sex ?? current.sex,
      activityLevel: activityLevel ?? current.activityLevel,
      goal: goal ?? current.goal,
    });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(weightKg !== undefined && { weightKg }),
      ...(heightCm !== undefined && { heightCm }),
      ...(age !== undefined && { age }),
      ...(sex !== undefined && { sex }),
      ...(activityLevel !== undefined && { activityLevel }),
      ...(goal !== undefined && { goal }),
      ...(displayName !== undefined && { displayName }),
      ...recalculatedGoals,
      // Las metas manuales, si vienen en el body, pisan lo recién
      // recalculado — así el usuario puede personalizar sus propios
      // números desde el perfil en vez de usar el cálculo automático.
      ...(dailyCalorieGoal !== undefined && { dailyCalorieGoal }),
      ...(dailyProteinGoalG !== undefined && { dailyProteinGoalG }),
      ...(dailyCarbsGoalG !== undefined && { dailyCarbsGoalG }),
      ...(dailyFatGoalG !== undefined && { dailyFatGoalG }),
    },
  });

  if (goalChanged) {
    // Cambiar de objetivo arranca un progreso de peso nuevo: el
    // historial anterior pertenecía a otro objetivo, así que se
    // reinicia y el peso actual pasa a ser el nuevo "peso inicial".
    await prisma.weightLog.deleteMany({ where: { userId: user.id } });
    if (user.weightKg != null) {
      await prisma.weightLog.create({ data: { userId: user.id, weightKg: user.weightKg } });
    }
  } else if (weightKg !== undefined) {
    await prisma.weightLog.create({ data: { userId: user.id, weightKg } });
  }

  res.json({ user });
}

// PATCH /api/users/me/photo  (multipart/form-data, campo "photo")
// Foto de perfil real: reutiliza la misma validación de tipo/tamaño que
// las fotos de platos (middleware/upload.js). Igual que con los platos,
// se guarda como data URL para no depender de un storage externo en este
// entorno — en producción se reemplazaría por Firebase Storage / S3.
async function uploadPhoto(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Falta el archivo de imagen ("photo").' });
  }

  const photoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { photoUrl },
  });

  res.json({ user });
}

module.exports = { getProfile, completeOnboarding, updateProfile, uploadPhoto };

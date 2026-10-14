const prisma = require('../config/prisma');
const { calculateDailyGoals } = require('../services/nutrition.service');
const { ageFromBirthDate } = require('../utils/age');
const { diffGoals } = require('../services/goals.service');

// GET /api/users/me
async function getProfile(req, res) {
  res.json({ user: req.user });
}

// PUT /api/users/me/onboarding
// Formulario inicial: carga de datos biométricos y meta calórica.
async function completeOnboarding(req, res) {
  const { weightKg, heightCm, sex, activityLevel, goal } = req.body;

  // Fecha de nacimiento (la edad se deriva).
  const birthDate = req.body.birthDate ? new Date(req.body.birthDate) : null;
  const age = birthDate ? ageFromBirthDate(birthDate) : Number(req.body.age);

  const goals = calculateDailyGoals({ weightKg, heightCm, age, sex, activityLevel, goal });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      weightKg,
      heightCm,
      age,
      ...(birthDate && { birthDate }),
      sex,
      activityLevel,
      goal,
      onboardingCompleted: true,
      ...goals,
      // Primera etapa: el gráfico de progreso cuenta desde acá.
      goalStartedAt: new Date(),
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
    weightKg, heightCm, activityLevel, goal, displayName,
    dailyCalorieGoal, dailyProteinGoalG, dailyCarbsGoalG, dailyFatGoalG,
  } = req.body;
  // El sexo no se edita desde el perfil (se define al registrarse). La edad
  // tampoco si el usuario cargó su fecha de nacimiento, se calcula sola.
  const age = req.user.birthDate ? undefined : req.body.age;

  const goalChanged = goal !== undefined && goal !== req.user.goal;

  const shouldRecalculate = [weightKg, heightCm, age, activityLevel, goal].some(
    (v) => v !== undefined,
  );

  let recalculatedGoals = {};
  if (shouldRecalculate) {
    const current = req.user;
    recalculatedGoals = calculateDailyGoals({
      weightKg: weightKg ?? current.weightKg,
      heightCm: heightCm ?? current.heightCm,
      age: age ?? current.age,
      sex: current.sex,
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
      ...(activityLevel !== undefined && { activityLevel }),
      ...(goal !== undefined && { goal }),
      // Cambiar de objetivo empieza una etapa nueva: el gráfico de progreso arranca de cero.
      ...(goalChanged && { goalStartedAt: new Date() }),
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

  await logGoalChanges(req.user, user, req.user.id);

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
// las fotos de platos (middleware/upload.js).
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

async function logGoalChanges(before, after, changedById) {
  const changes = diffGoals(before, after);
  if (!Object.keys(changes).length) return;
  await prisma.goalChangeLog.create({ data: { userId: after.id, changedById, changes } });
}

// POST /api/users/me/goals-notice/seen
async function markGoalsNoticeSeen(req, res) {
  const user = req.user.goalsNoticePending
    ? await prisma.user.update({ where: { id: req.user.id }, data: { goalsNoticePending: false } })
    : req.user;
  res.json({ user });
}

// POST /api/users/me/role  { role: 'NUTRITIONIST' | 'USER' }
// Elección de tipo de cuenta al registrarse ("Soy usuario" / "Soy nutricionista").
// Un rol por cuenta: solo se puede cambiar en cuentas nuevas, sin datos.
async function changeRole(req, res) {
  const { role } = req.body;
  const user = req.user;
  if (role === user.role) return res.json({ user });

  if (role === 'NUTRITIONIST') {
    const [meals, activeLink] = await Promise.all([
      prisma.meal.count({ where: { userId: user.id } }),
      prisma.patientLink.count({ where: { patientId: user.id, status: 'ACTIVE' } }),
    ]);
    if (user.role !== 'USER') {
      return res.status(409).json({ error: 'Esta cuenta ya tiene otro rol asignado.' });
    }
    if (user.onboardingCompleted || meals > 0 || activeLink > 0) {
      return res.status(409).json({
        error: 'Esta cuenta ya se usa como paciente. Para ser nutricionista creá una cuenta nueva con otro correo.',
      });
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { role: 'NUTRITIONIST' } });
    return res.json({ user: updated });
  }

  if (role === 'USER') {
    const profile = await prisma.nutritionistProfile.findUnique({ where: { userId: user.id } });
    if (user.role !== 'NUTRITIONIST' || profile?.status === 'APPROVED') {
      return res.status(409).json({ error: 'Esta cuenta de nutricionista ya fue aprobada y no se puede convertir en cuenta de paciente.' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (profile) await tx.nutritionistProfile.delete({ where: { id: profile.id } });
      return tx.user.update({ where: { id: user.id }, data: { role: 'USER' } });
    });
    return res.json({ user: updated });
  }

  return res.status(422).json({ error: 'Rol inválido.' });
}

module.exports = {
  getProfile, completeOnboarding, updateProfile, uploadPhoto, markGoalsNoticeSeen, logGoalChanges, changeRole,
};

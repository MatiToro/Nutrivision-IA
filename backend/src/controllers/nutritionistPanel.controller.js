const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { randomCode } = require('../utils/codes');
const { ageFromBirthDate } = require('../utils/age');
const { isPremiumUser } = require('../utils/premium');
const { applyGoalUpdate } = require('../services/goals.service');
const { publicSubscription } = require('../services/subscription.service');
const {
  hasActiveSubscription, ratingsFor, shortName, EMPTY_RATING,
} = require('../services/nutritionist.service');

// Suscripción mensual y códigos Premium por mes pagado.
const SUBSCRIPTION_DAYS = 30;
const PREMIUM_CODES_PER_MONTH = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const PROFILE_FIELDS = ['bio', 'specialties', 'contactWhatsapp', 'contactEmail', 'contactInstagram', 'contactOther'];

function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

// Normaliza textos opcionales: "" -> null.
function cleanContacts(data) {
  const out = { ...data };
  for (const f of ['bio', 'contactWhatsapp', 'contactEmail', 'contactInstagram', 'contactOther']) {
    if (out[f] !== undefined) out[f] = typeof out[f] === 'string' && out[f].trim() ? out[f].trim() : null;
  }
  if (out.specialties !== undefined) {
    out.specialties = [...new Set((out.specialties || []).map((s) => String(s).trim()).filter(Boolean))];
  }
  return out;
}

const hasSomeContact = (p) => Boolean(p.contactWhatsapp || p.contactEmail || p.contactInstagram || p.contactOther);

async function uniqueLinkCode(tx = prisma) {
  for (let i = 0; i < 5; i += 1) {
    const code = randomCode(8);
    // eslint-disable-next-line no-await-in-loop
    const taken = await tx.nutritionistProfile.findUnique({ where: { linkCode: code } });
    if (!taken) return code;
  }
  throw new Error('No se pudo generar un código de vinculación único.');
}

async function getProfileOf(userId) {
  return prisma.nutritionistProfile.findUnique({ where: { userId } });
}

// ---------------------------------------------------------------------------
// Mi cuenta de nutricionista
// ---------------------------------------------------------------------------

// GET /api/nutritionist/me
// Todo lo que necesita la app del nutricionista: estado de la solicitud,
// perfil, suscripción, códigos Premium del mes y estadísticas.
async function getMe(req, res) {
  const profile = await getProfileOf(req.user.id);
  const base = { user: { displayName: req.user.displayName, photoUrl: req.user.photoUrl, email: req.user.email } };
  if (!profile) return res.json({ ...base, profile: null });

  const now = new Date();
  const [activePatients, ratings, lastPayment, payments, mpSubs] = await Promise.all([
    prisma.patientLink.count({ where: { nutritionistId: profile.id, status: 'ACTIVE' } }),
    ratingsFor([profile.id]),
    prisma.nutritionistPayment.findFirst({ where: { nutritionistId: profile.id }, orderBy: { createdAt: 'desc' } }),
    prisma.nutritionistPayment.findMany({ where: { nutritionistId: profile.id }, orderBy: { createdAt: 'desc' }, take: 6 }),
    // Suscripción con Mercado Pago (débito automático mensual)
    prisma.subscription.findMany({
      where: { userId: req.user.id, kind: 'NUTRITIONIST', status: { not: 'PENDING' } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);
  const mpSub = mpSubs.find((x) => x.status === 'AUTHORIZED' || (x.accessUntil && x.accessUntil > now)) || null;

  // Códigos del último mes pagado (vencen con ese mes: no se acumulan).
  const codes = lastPayment
    ? await prisma.premiumCode.findMany({
      where: { nutritionistId: profile.id, periodEnd: lastPayment.periodEnd },
      include: { redeemedBy: { select: { displayName: true } } },
      orderBy: { code: 'asc' },
    })
    : [];

  res.json({
    ...base,
    profile: {
      id: profile.id,
      licenseNumber: profile.licenseNumber,
      bio: profile.bio || '',
      specialties: profile.specialties || [],
      contactWhatsapp: profile.contactWhatsapp,
      contactEmail: profile.contactEmail,
      contactInstagram: profile.contactInstagram,
      contactOther: profile.contactOther,
      status: profile.status,
      rejectionReason: profile.rejectionReason,
      reviewedAt: profile.reviewedAt,
      linkCode: profile.linkCode,
      createdAt: profile.createdAt,
    },
    subscription: {
      active: hasActiveSubscription(profile, now),
      until: profile.subscriptionUntil,
      // null si no hay suscripción de Mercado Pago vigente
      mercadoPago: mpSub ? publicSubscription(mpSub) : null,
    },
    stats: { activePatients, rating: ratings.get(profile.id) || EMPTY_RATING },
    premiumCodes: codes.map((c) => ({
      code: c.code,
      periodEnd: c.periodEnd,
      expired: c.periodEnd <= now,
      redeemed: Boolean(c.redeemedById),
      redeemedAt: c.redeemedAt,
      redeemedBy: c.redeemedById ? shortName(c.redeemedBy?.displayName) : null,
    })),
    payments: payments.map((p) => ({
      id: p.id, periodStart: p.periodStart, periodEnd: p.periodEnd, amount: p.amount, createdAt: p.createdAt,
    })),
  });
}

// PUT /api/nutritionist/me/application
// Solicitud de alta: matrícula, descripción, especialidades y contactos.
// Queda PENDIENTE hasta que un Administrador la apruebe. Si fue rechazada,
// se puede corregir y volver a enviar.
async function submitApplication(req, res) {
  const current = await getProfileOf(req.user.id);
  if (current?.status === 'APPROVED') {
    return res.status(409).json({ error: 'Tu cuenta ya está aprobada. Editá tus datos desde "Mi perfil".' });
  }

  const data = cleanContacts(pick(req.body, PROFILE_FIELDS));
  const licenseNumber = String(req.body.licenseNumber).trim();
  if (!hasSomeContact({ ...current, ...data })) {
    return res.status(422).json({ error: 'Cargá al menos un medio de contacto para que tus pacientes puedan escribirte.' });
  }

  const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
  if (displayName && displayName !== req.user.displayName) {
    await prisma.user.update({ where: { id: req.user.id }, data: { displayName } });
  }

  const reset = { status: 'PENDING', rejectionReason: null, reviewedAt: null, reviewedById: null };
  if (current) {
    await prisma.nutritionistProfile.update({ where: { id: current.id }, data: { ...data, licenseNumber, ...reset } });
  } else {
    await prisma.nutritionistProfile.create({
      data: { ...data, licenseNumber, userId: req.user.id, linkCode: await uniqueLinkCode(), ...reset },
    });
  }
  logger.info(`Solicitud de nutricionista enviada por ${req.user.id}`);

  req.user = await prisma.user.findUnique({ where: { id: req.user.id } });
  return getMe(req, res);
}

// PATCH /api/nutritionist/me/profile
// Edición del perfil público (nombre, descripción, especialidades, contactos).
// La matrícula no se cambia una vez aprobada (la verificó un Administrador).
async function updateMyProfile(req, res) {
  const current = await getProfileOf(req.user.id);
  if (!current) return res.status(404).json({ error: 'Todavía no enviaste tu solicitud.' });

  const data = cleanContacts(pick(req.body, PROFILE_FIELDS));
  if (!hasSomeContact({ ...current, ...data })) {
    return res.status(422).json({ error: 'Dejá al menos un medio de contacto.' });
  }

  const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
  if (displayName && displayName !== req.user.displayName) {
    req.user = await prisma.user.update({ where: { id: req.user.id }, data: { displayName } });
  }
  if (Object.keys(data).length) {
    await prisma.nutritionistProfile.update({ where: { id: current.id }, data });
  }
  return getMe(req, res);
}

// POST /api/nutritionist/me/link-code
// Genera un código de vinculación nuevo (el anterior deja de servir; los
// pacientes ya vinculados no se ven afectados).
async function regenerateLinkCode(req, res) {
  const current = await getProfileOf(req.user.id);
  if (!current) return res.status(404).json({ error: 'Todavía no enviaste tu solicitud.' });
  await prisma.nutritionistProfile.update({ where: { id: current.id }, data: { linkCode: await uniqueLinkCode() } });
  return getMe(req, res);
}

// DELETE /api/nutritionist/me/subscription
// Cancela en el momento: deja de aparecer en el directorio,
// pierde acceso a las fichas y los códigos sin usar vencen. Los vínculos se conservan.
async function cancelSubscription(req, res) {
  const profile = await getProfileOf(req.user.id);
  const now = new Date();
  if (!profile || !hasActiveSubscription(profile, now)) {
    return res.status(409).json({ error: 'No tenés una suscripción activa.' });
  }
  const lastPayment = await prisma.nutritionistPayment.findFirst({
    where: { nutritionistId: profile.id }, orderBy: { createdAt: 'desc' },
  });

  await prisma.$transaction([
    prisma.nutritionistProfile.update({ where: { id: profile.id }, data: { subscriptionUntil: now } }),
    ...(lastPayment ? [
      prisma.premiumCode.updateMany({
        where: { nutritionistId: profile.id, periodEnd: lastPayment.periodEnd },
        data: { periodEnd: now },
      }),
      prisma.nutritionistPayment.update({ where: { id: lastPayment.id }, data: { periodEnd: now } }),
    ] : []),
  ]);
  logger.info(`Suscripción de nutricionista ${profile.id} cancelada`);
  return getMe(req, res);
}

// ---------------------------------------------------------------------------
// Pacientes
// ---------------------------------------------------------------------------

// Verifica que el nutricionista pueda ver fichas: aprobado y con suscripción.
async function requirePanelAccess(req, res) {
  const profile = await getProfileOf(req.user.id);
  if (!profile || profile.status !== 'APPROVED') {
    res.status(403).json({ error: 'Tu cuenta todavía no fue aprobada.', code: 'NOT_APPROVED' });
    return null;
  }
  if (!hasActiveSubscription(profile)) {
    res.status(403).json({
      error: 'Tu suscripción no está activa. Activala para volver a ver las fichas de tus pacientes.',
      code: 'SUBSCRIPTION_REQUIRED',
    });
    return null;
  }
  return profile;
}

// Paciente con vínculo ACTIVO con este nutricionista (si no, 404).
async function findPatient(profile, patientId, res) {
  const link = await prisma.patientLink.findFirst({
    where: { nutritionistId: profile.id, patientId, status: 'ACTIVE' },
    include: { patient: true },
  });
  if (!link) {
    res.status(404).json({ error: 'Este paciente no está vinculado con vos.' });
    return null;
  }
  return link;
}

// GET /api/nutritionist/patients?todayFrom=ISO
// Lista de pacientes activos con el consumo de hoy.
async function listPatients(req, res) {
  const profile = await requirePanelAccess(req, res);
  if (!profile) return;

  const parsed = new Date(req.query.todayFrom);
  const todayFrom = Number.isNaN(parsed.getTime())
    ? new Date(new Date().setHours(0, 0, 0, 0))
    : parsed;

  const links = await prisma.patientLink.findMany({
    where: { nutritionistId: profile.id, status: 'ACTIVE' },
    include: {
      patient: {
        select: {
          id: true, displayName: true, photoUrl: true, goal: true, dailyCalorieGoal: true, weightKg: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const ids = links.map((l) => l.patientId);

  const [todayRows, lastRows] = ids.length ? await Promise.all([
    prisma.meal.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, loggedAt: { gte: todayFrom } },
      _sum: { totalCalories: true },
      _count: { _all: true },
    }),
    prisma.meal.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { loggedAt: true } }),
  ]) : [[], []];
  const today = new Map(todayRows.map((r) => [r.userId, r]));
  const last = new Map(lastRows.map((r) => [r.userId, r._max.loggedAt]));

  res.json({
    patients: links.map((l) => ({
      id: l.patient.id,
      name: l.patient.displayName || 'Paciente',
      photoUrl: l.patient.photoUrl,
      goal: l.patient.goal,
      weightKg: l.patient.weightKg,
      since: l.createdAt,
      today: {
        calories: Math.round(today.get(l.patientId)?._sum.totalCalories || 0),
        meals: today.get(l.patientId)?._count._all || 0,
        calorieGoal: l.patient.dailyCalorieGoal,
      },
      lastMealAt: last.get(l.patientId) || null,
    })),
  });
}

// GET /api/nutritionist/patients/:id
// Ficha del paciente: datos, objetivo, metas, peso y cambios de metas.
// Las comidas se piden aparte por rango de fechas (ver listPatientMeals).
async function getPatient(req, res) {
  const profile = await requirePanelAccess(req, res);
  if (!profile) return;
  const link = await findPatient(profile, req.params.id, res);
  if (!link) return;
  const p = link.patient;

  const [weightLogs, goalChanges] = await Promise.all([
    prisma.weightLog.findMany({ where: { userId: p.id }, orderBy: { loggedAt: 'asc' }, take: 90 }),
    prisma.goalChangeLog.findMany({
      where: { userId: p.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { changedBy: { select: { id: true, role: true } } },
    }),
  ]);

  res.json({
    patient: {
      id: p.id,
      name: p.displayName || 'Paciente',
      photoUrl: p.photoUrl,
      age: p.birthDate ? ageFromBirthDate(p.birthDate) : p.age,
      sex: p.sex,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      activityLevel: p.activityLevel,
      goal: p.goal,
      dailyCalorieGoal: p.dailyCalorieGoal,
      dailyProteinGoalG: p.dailyProteinGoalG,
      dailyCarbsGoalG: p.dailyCarbsGoalG,
      dailyFatGoalG: p.dailyFatGoalG,
      isPremium: isPremiumUser(p),
      since: link.createdAt,
    },
    weightLogs: weightLogs.map((w) => ({ weightKg: w.weightKg, loggedAt: w.loggedAt })),
    goalChanges: goalChanges.map((g) => ({
      id: g.id,
      changes: g.changes,
      createdAt: g.createdAt,
      by: g.changedById === req.user.id ? 'YOU' : g.changedById === p.id ? 'PATIENT' : 'OTHER',
    })),
  });
}

// GET /api/nutritionist/patients/:id/meals?from=&to=  (máximo 31 días)
async function listPatientMeals(req, res) {
  const profile = await requirePanelAccess(req, res);
  if (!profile) return;
  const link = await findPatient(profile, req.params.id, res);
  if (!link) return;

  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from || to - from > 31 * DAY_MS) {
    return res.status(422).json({ error: 'Rango de fechas inválido (máximo 31 días).' });
  }

  const meals = await prisma.meal.findMany({
    where: { userId: link.patientId, loggedAt: { gte: from, lte: to } },
    select: {
      id: true, name: true, imageUrl: true, loggedAt: true,
      totalCalories: true, totalProteinG: true, totalCarbsG: true, totalFatG: true,
    },
    orderBy: { loggedAt: 'desc' },
  });
  res.json({ meals });
}

// GET /api/nutritionist/patients/:id/meals/:mealId
async function getPatientMeal(req, res) {
  const profile = await requirePanelAccess(req, res);
  if (!profile) return;
  const link = await findPatient(profile, req.params.id, res);
  if (!link) return;

  const meal = await prisma.meal.findFirst({
    where: { id: req.params.mealId, userId: link.patientId },
    select: {
      id: true, name: true, imageUrl: true, loggedAt: true, source: true,
      totalCalories: true, totalProteinG: true, totalCarbsG: true, totalFatG: true,
      ingredients: true, coachFeedback: true,
    },
  });
  if (!meal) return res.status(404).json({ error: 'Plato no encontrado.' });
  res.json({ meal });
}

// PATCH /api/nutritionist/patients/:id/goals
// El nutricionista ajusta objetivo y/o metas: queda registrado quién lo
// cambió y el paciente ve un aviso una sola vez.
async function updatePatientGoals(req, res) {
  const profile = await requirePanelAccess(req, res);
  if (!profile) return;
  const link = await findPatient(profile, req.params.id, res);
  if (!link) return;

  const { user, changes } = await applyGoalUpdate(link.patient, req.body, { changedById: req.user.id, notify: true });
  if (Object.keys(changes).length) {
    logger.info(`Nutricionista ${profile.id} cambió metas del paciente ${user.id}: ${Object.keys(changes).join(', ')}`);
  }
  req.params.id = user.id;
  return getPatient(req, res);
}

// DELETE /api/nutritionist/patients/:id
// Quitar paciente. Se puede hacer aunque la suscripción no esté activa.
async function removePatient(req, res) {
  const profile = await getProfileOf(req.user.id);
  if (!profile) return res.status(404).json({ error: 'Todavía no enviaste tu solicitud.' });
  const { count } = await prisma.patientLink.updateMany({
    where: { nutritionistId: profile.id, patientId: req.params.id, status: 'ACTIVE' },
    data: { status: 'ENDED', endedAt: new Date(), endedBy: 'NUTRITIONIST' },
  });
  if (!count) return res.status(404).json({ error: 'Este paciente no está vinculado con vos.' });
  logger.info(`Nutricionista ${profile.id} quitó al paciente ${req.params.id}`);
  res.json({ ok: true });
}

// GET /api/nutritionist/me/reviews  — valoraciones recibidas
async function listMyReviews(req, res) {
  const profile = await getProfileOf(req.user.id);
  if (!profile) return res.json({ reviews: [] });
  const reviews = await prisma.review.findMany({
    where: { nutritionistId: profile.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { patient: { select: { displayName: true } } },
  });
  res.json({
    reviews: reviews.map((r) => ({
      id: r.id, stars: r.stars, comment: r.comment, author: shortName(r.patient?.displayName), updatedAt: r.updatedAt,
    })),
  });
}

module.exports = {
  getMe,
  submitApplication,
  updateMyProfile,
  regenerateLinkCode,
  cancelSubscription,
  listPatients,
  getPatient,
  listPatientMeals,
  getPatientMeal,
  updatePatientGoals,
  removePatient,
  listMyReviews,
  SUBSCRIPTION_DAYS,
  PREMIUM_CODES_PER_MONTH,
};

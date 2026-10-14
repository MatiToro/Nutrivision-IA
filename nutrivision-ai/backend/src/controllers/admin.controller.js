const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { isPremiumUser } = require('../utils/premium');
const { ageFromBirthDate } = require('../utils/age');
const { hasActiveSubscription, ratingsFor, EMPTY_RATING } = require('../services/nutritionist.service');

const PAGE_SIZE = 30;

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

// GET /api/admin/stats
async function getStats(req, res) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [byRole, banned, paidPremium, codePremium, pending, approved, activeSubs, activeLinks, mealsToday] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { role: 'USER', plan: 'PREMIUM' } }),
    prisma.user.count({ where: { role: 'USER', plan: 'FREE', premiumUntil: { gt: now } } }),
    prisma.nutritionistProfile.count({ where: { status: 'PENDING' } }),
    prisma.nutritionistProfile.count({ where: { status: 'APPROVED' } }),
    prisma.nutritionistProfile.count({ where: { status: 'APPROVED', subscriptionUntil: { gt: now } } }),
    prisma.patientLink.count({ where: { status: 'ACTIVE' } }),
    prisma.meal.count({ where: { loggedAt: { gte: startOfDay } } }),
  ]);
  const roles = Object.fromEntries(byRole.map((r) => [r.role, r._count._all]));

  res.json({
    users: { USER: roles.USER || 0, NUTRITIONIST: roles.NUTRITIONIST || 0, ADMIN: roles.ADMIN || 0, banned },
    premium: { paid: paidPremium, byCode: codePremium },
    nutritionists: { pending, approved, activeSubscriptions: activeSubs },
    activeLinks,
    mealsToday,
  });
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

function userRow(u, now = new Date()) {
  return {
    id: u.id,
    name: u.displayName || 'Sin nombre',
    email: u.email,
    photoUrl: u.photoUrl,
    role: u.role,
    plan: u.plan,
    isPremium: isPremiumUser(u, now),
    premiumUntil: u.premiumUntil && new Date(u.premiumUntil) > now ? u.premiumUntil : null,
    banned: u.banned,
    createdAt: u.createdAt,
    nutritionistStatus: u.nutritionistProfile?.status || null,
  };
}

// GET /api/admin/users?q=&filter=ALL|USER|NUTRITIONIST|ADMIN|BANNED|PREMIUM&page=1
async function listUsers(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const filter = String(req.query.filter || 'ALL');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const now = new Date();

  const and = [];
  if (q) {
    and.push({ OR: [{ displayName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] });
  }
  if (['USER', 'NUTRITIONIST', 'ADMIN'].includes(filter)) and.push({ role: filter });
  if (filter === 'BANNED') and.push({ banned: true });
  if (filter === 'PREMIUM') and.push({ role: 'USER' }, { OR: [{ plan: 'PREMIUM' }, { premiumUntil: { gt: now } }] });
  const where = and.length ? { AND: and } : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { nutritionistProfile: { select: { status: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  res.json({ users: users.map((u) => userRow(u, now)), total, page, pageSize: PAGE_SIZE, hasMore: page * PAGE_SIZE < total });
}

// GET /api/admin/users/:id
async function getUser(req, res) {
  const u = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      nutritionistProfile: { select: { id: true, status: true, licenseNumber: true, subscriptionUntil: true } },
      _count: { select: { meals: true } },
    },
  });
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const [lastMeal, activeLink, patients] = await Promise.all([
    prisma.meal.findFirst({ where: { userId: u.id }, orderBy: { loggedAt: 'desc' }, select: { loggedAt: true } }),
    prisma.patientLink.findFirst({
      where: { patientId: u.id, status: 'ACTIVE' },
      include: { nutritionist: { include: { user: { select: { displayName: true } } } } },
    }),
    u.nutritionistProfile
      ? prisma.patientLink.count({ where: { nutritionistId: u.nutritionistProfile.id, status: 'ACTIVE' } })
      : 0,
  ]);

  res.json({
    user: {
      ...userRow(u),
      age: u.birthDate ? ageFromBirthDate(u.birthDate) : u.age,
      goal: u.goal,
      onboardingCompleted: u.onboardingCompleted,
      provider: u.provider,
      mealsCount: u._count.meals,
      lastMealAt: lastMeal?.loggedAt || null,
      isSelf: u.id === req.user.id,
      nutritionist: activeLink
        ? { id: activeLink.nutritionistId, name: activeLink.nutritionist.user?.displayName || 'Nutricionista' }
        : null,
      nutritionistProfile: u.nutritionistProfile
        ? {
          id: u.nutritionistProfile.id,
          status: u.nutritionistProfile.status,
          licenseNumber: u.nutritionistProfile.licenseNumber,
          subscriptionActive: hasActiveSubscription(u.nutritionistProfile),
          activePatients: patients,
        }
        : null,
    },
  });
}

// PATCH /api/admin/users/:id  { role?, plan?, banned? }
// Cambiar rol o plan y banear/desbanear. Un administrador no puede cambiarse
// el rol ni banearse a sí mismo.
async function updateUser(req, res) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const { role, plan, banned } = req.body;
  if (target.id === req.user.id && (role !== undefined || banned !== undefined)) {
    return res.status(409).json({ error: 'No podés cambiar tu propio rol ni banear tu propia cuenta.' });
  }

  const data = {
    ...(role !== undefined && { role }),
    // Pro dado por un administrador: sin vencimiento (planUntil = null).
    ...(plan !== undefined && { plan, planUntil: null }),
    ...(banned !== undefined && { banned }),
  };
  if (!Object.keys(data).length) return res.status(422).json({ error: 'No hay cambios para guardar.' });

  const roleChanged = role !== undefined && role !== target.role;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data });
    // Si deja de ser paciente, se corta su vínculo activo con un nutricionista.
    if (roleChanged && target.role === 'USER') {
      await tx.patientLink.updateMany({
        where: { patientId: target.id, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: new Date(), endedBy: 'PATIENT' },
      });
    }
  });

  logger.info(`Admin ${req.user.id} modificó al usuario ${target.id}: ${JSON.stringify(data)}`);
  return getUser(req, res);
}

// ---------------------------------------------------------------------------
// Nutricionistas
// ---------------------------------------------------------------------------

function nutritionistRow(p, rating, patients, now = new Date()) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.user?.displayName || 'Sin nombre',
    email: p.user?.email,
    photoUrl: p.user?.photoUrl,
    banned: p.user?.banned || false,
    licenseNumber: p.licenseNumber,
    specialties: p.specialties || [],
    status: p.status,
    rejectionReason: p.rejectionReason,
    reviewedAt: p.reviewedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    subscriptionActive: hasActiveSubscription(p, now),
    subscriptionUntil: p.subscriptionUntil,
    rating: rating || EMPTY_RATING,
    activePatients: patients ?? 0,
  };
}

// GET /api/admin/nutritionists?status=PENDING|APPROVED|REJECTED&q=
async function listNutritionists(req, res) {
  const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status) ? req.query.status : 'PENDING';
  const q = String(req.query.q || '').trim().slice(0, 80);

  const profiles = await prisma.nutritionistProfile.findMany({
    where: {
      status,
      user: { role: 'NUTRITIONIST' },
      ...(q && {
        OR: [
          { licenseNumber: { contains: q, mode: 'insensitive' } },
          { user: { displayName: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
        ],
      }),
    },
    include: { user: { select: { displayName: true, email: true, photoUrl: true, banned: true } } },
    // Las solicitudes pendientes, de la más vieja a la más nueva (orden de llegada).
    orderBy: status === 'PENDING' ? { updatedAt: 'asc' } : { updatedAt: 'desc' },
    take: 100,
  });

  const ids = profiles.map((p) => p.id);
  const [ratings, patientRows] = await Promise.all([
    ratingsFor(ids),
    ids.length
      ? prisma.patientLink.groupBy({ by: ['nutritionistId'], where: { nutritionistId: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } })
      : [],
  ]);
  const patients = new Map(patientRows.map((r) => [r.nutritionistId, r._count._all]));

  res.json({ nutritionists: profiles.map((p) => nutritionistRow(p, ratings.get(p.id), patients.get(p.id))) });
}

// GET /api/admin/nutritionists/:id  — solicitud completa (datos y contactos)
async function getNutritionist(req, res) {
  const p = await prisma.nutritionistProfile.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { displayName: true, email: true, photoUrl: true, banned: true } },
      reviewedBy: { select: { displayName: true, email: true } },
    },
  });
  if (!p) return res.status(404).json({ error: 'Solicitud no encontrada.' });

  const [ratings, patients] = await Promise.all([
    ratingsFor([p.id]),
    prisma.patientLink.count({ where: { nutritionistId: p.id, status: 'ACTIVE' } }),
  ]);

  res.json({
    nutritionist: {
      ...nutritionistRow(p, ratings.get(p.id), patients),
      bio: p.bio || '',
      contacts: {
        whatsapp: p.contactWhatsapp, email: p.contactEmail, instagram: p.contactInstagram, other: p.contactOther,
      },
      reviewedBy: p.reviewedBy ? (p.reviewedBy.displayName || p.reviewedBy.email) : null,
    },
  });
}

// POST /api/admin/nutritionists/:id/approve
async function approveNutritionist(req, res) {
  const p = await prisma.nutritionistProfile.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (p.status === 'APPROVED') return res.status(409).json({ error: 'Este nutricionista ya está aprobado.' });

  await prisma.nutritionistProfile.update({
    where: { id: p.id },
    data: { status: 'APPROVED', rejectionReason: null, reviewedAt: new Date(), reviewedById: req.user.id },
  });
  logger.info(`Admin ${req.user.id} aprobó al nutricionista ${p.id}`);
  return getNutritionist(req, res);
}

// POST /api/admin/nutritionists/:id/reject  { reason }
// Rechaza una solicitud pendiente o revoca una aprobación (deja de aparecer
// en el directorio y pierde acceso a las fichas). El nutricionista ve el motivo
// y puede corregir y reenviar.
async function rejectNutritionist(req, res) {
  const p = await prisma.nutritionistProfile.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  if (p.status === 'REJECTED') return res.status(409).json({ error: 'Esta solicitud ya está rechazada.' });

  await prisma.nutritionistProfile.update({
    where: { id: p.id },
    data: { status: 'REJECTED', rejectionReason: String(req.body.reason).trim(), reviewedAt: new Date(), reviewedById: req.user.id },
  });
  logger.info(`Admin ${req.user.id} rechazó al nutricionista ${p.id}`);
  return getNutritionist(req, res);
}

module.exports = {
  getStats,
  listUsers,
  getUser,
  updateUser,
  listNutritionists,
  getNutritionist,
  approveNutritionist,
  rejectNutritionist,
};

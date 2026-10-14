const prisma = require('../config/prisma');
const { isPremiumUser } = require('../utils/premium');
const {
  listedWhere, isListed, ratingsFor, publicCard, contactsOf, shortName,
} = require('../services/nutritionist.service');

const PAGE_SIZE = 30;

// GET /api/nutritionists?q=&specialty=
// Directorio: solo nutricionistas aprobados y con suscripción vigente.
// Nunca devuelve contactos (eso es por perfil y solo para Premium).
async function listNutritionists(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const specialty = String(req.query.specialty || '').trim().slice(0, 60);

  const where = {
    ...listedWhere(),
    ...(specialty && { specialties: { has: specialty } }),
    ...(q && {
      OR: [
        { user: { displayName: { contains: q, mode: 'insensitive' } } },
        { bio: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };

  const profiles = await prisma.nutritionistProfile.findMany({
    where,
    include: { user: { select: { displayName: true, photoUrl: true } } },
    orderBy: { createdAt: 'asc' },
    take: PAGE_SIZE,
  });

  const ratings = await ratingsFor(profiles.map((p) => p.id));
  const nutritionists = profiles
    .map((p) => publicCard(p, ratings.get(p.id)))
    // Mejor valorados primero; sin valoraciones al final.
    .sort((a, b) => (b.rating.average ?? -1) - (a.rating.average ?? -1) || b.rating.count - a.rating.count);

  // Especialidades disponibles para los filtros de la pantalla.
  const all = await prisma.nutritionistProfile.findMany({ where: listedWhere(), select: { specialties: true } });
  const specialties = [...new Set(all.flatMap((p) => p.specialties || []))].sort((a, b) => a.localeCompare(b, 'es'));

  res.json({ nutritionists, specialties });
}

// GET /api/nutritionists/:id
// Perfil público. Lo pueden ver todos si está en el directorio, y además
// sus pacientes (actuales o anteriores) aunque haya dejado de pagar.
// Los contactos solo se devuelven a usuarios Premium: la restricción es del backend, no solo visual.
async function getNutritionist(req, res) {
  const profile = await prisma.nutritionistProfile.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { displayName: true, photoUrl: true, role: true, banned: true } } },
  });

  const [activeLink, anyLink] = profile
    ? await Promise.all([
      prisma.patientLink.findFirst({ where: { nutritionistId: profile.id, patientId: req.user.id, status: 'ACTIVE' } }),
      prisma.patientLink.findFirst({ where: { nutritionistId: profile.id, patientId: req.user.id } }),
    ])
    : [null, null];

  const listed = isListed(profile);
  if (!profile || (!listed && !anyLink) || profile.user.banned) {
    return res.status(404).json({ error: 'No encontramos a este nutricionista.' });
  }

  const [ratings, reviews, myReview] = await Promise.all([
    ratingsFor([profile.id]),
    prisma.review.findMany({
      where: { nutritionistId: profile.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { patient: { select: { displayName: true } } },
    }),
    prisma.review.findUnique({
      where: { nutritionistId_patientId: { nutritionistId: profile.id, patientId: req.user.id } },
    }),
  ]);

  const premium = isPremiumUser(req.user);
  const canSeeContacts = premium && (listed || Boolean(activeLink));

  res.json({
    nutritionist: {
      ...publicCard(profile, ratings.get(profile.id)),
      listed,
      contacts: canSeeContacts ? contactsOf(profile) : null,
      // true = los contactos existen pero hace falta Premium para verlos.
      contactsLocked: !premium,
      reviews: reviews.map((r) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        author: r.patientId === req.user.id ? 'Vos' : shortName(r.patient?.displayName),
        mine: r.patientId === req.user.id,
        updatedAt: r.updatedAt,
      })),
    },
    link: activeLink ? 'ACTIVE' : anyLink ? 'PAST' : null,
    // Solo pacientes actuales o anteriores pueden valorar.
    canReview: Boolean(anyLink) && req.user.role === 'USER',
    myReview: myReview ? { stars: myReview.stars, comment: myReview.comment, updatedAt: myReview.updatedAt } : null,
  });
}

// PUT /api/nutritionists/:id/review  { stars: 1-5, comment? }
// Crea o edita la valoración del paciente. Se mantiene y se puede seguir
// editando aunque el paciente se haya desvinculado.
async function upsertReview(req, res) {
  const nutritionistId = req.params.id;
  const link = await prisma.patientLink.findFirst({ where: { nutritionistId, patientId: req.user.id } });
  if (!link) {
    return res.status(403).json({ error: 'Solo podés valorar a un nutricionista con el que estés o hayas estado vinculado.' });
  }

  const stars = Number(req.body.stars);
  const comment = typeof req.body.comment === 'string' && req.body.comment.trim() ? req.body.comment.trim() : null;

  const review = await prisma.review.upsert({
    where: { nutritionistId_patientId: { nutritionistId, patientId: req.user.id } },
    create: { nutritionistId, patientId: req.user.id, stars, comment },
    update: { stars, comment },
  });

  res.json({ review: { stars: review.stars, comment: review.comment, updatedAt: review.updatedAt } });
}

module.exports = { listNutritionists, getNutritionist, upsertReview };

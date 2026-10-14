const prisma = require('../config/prisma');

// Condición para aparecer en el directorio: aprobado por un Administrador,
// con suscripción vigente y con la cuenta activa.
function listedWhere(now = new Date()) {
  return {
    status: 'APPROVED',
    subscriptionUntil: { gt: now },
    user: { role: 'NUTRITIONIST', banned: false },
  };
}

function isListed(profile, now = new Date()) {
  return Boolean(
    profile
    && profile.status === 'APPROVED'
    && profile.subscriptionUntil && new Date(profile.subscriptionUntil) > now
    && profile.user && profile.user.role === 'NUTRITIONIST' && !profile.user.banned,
  );
}

function hasActiveSubscription(profile, now = new Date()) {
  return Boolean(profile?.subscriptionUntil && new Date(profile.subscriptionUntil) > now);
}

// Promedio de estrellas y cantidad de valoraciones de varios nutricionistas.
async function ratingsFor(ids) {
  if (!ids.length) return new Map();
  const rows = await prisma.review.groupBy({
    by: ['nutritionistId'],
    where: { nutritionistId: { in: ids } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.nutritionistId, {
    average: r._avg.stars ? Math.round(r._avg.stars * 10) / 10 : null,
    count: r._count._all,
  }]));
}

const EMPTY_RATING = { average: null, count: 0 };

// Datos públicos del nutricionista (sin contactos: esos dependen del plan).
function publicCard(profile, rating) {
  return {
    id: profile.id,
    name: profile.user?.displayName || 'Nutricionista',
    photoUrl: profile.user?.photoUrl || null,
    licenseNumber: profile.licenseNumber,
    specialties: profile.specialties || [],
    bio: profile.bio || '',
    rating: rating || EMPTY_RATING,
  };
}

function contactsOf(profile) {
  return {
    whatsapp: profile.contactWhatsapp || null,
    email: profile.contactEmail || null,
    instagram: profile.contactInstagram || null,
    other: profile.contactOther || null,
  };
}

// "Juan Perez" -> "Juan P." (las reseñas son públicas: no se muestra el apellido).
function shortName(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Paciente';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

module.exports = { listedWhere, isListed, hasActiveSubscription, ratingsFor, publicCard, contactsOf, shortName, EMPTY_RATING };

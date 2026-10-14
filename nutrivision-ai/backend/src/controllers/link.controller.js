const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { normalizeCode } = require('../utils/codes');
const { isListed, ratingsFor, publicCard } = require('../services/nutritionist.service');

const withUser = { user: { select: { displayName: true, photoUrl: true, role: true, banned: true } } };

// Busca un nutricionista por su código de vinculación. Solo sirve si está
// aprobado, con suscripción vigente y con la cuenta activa.
async function findByLinkCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (code.length < 4) return null;
  const profile = await prisma.nutritionistProfile.findUnique({ where: { linkCode: code }, include: withUser });
  return isListed(profile) ? profile : null;
}

const INVALID_CODE = 'El código no es válido o el nutricionista no está disponible. Revisalo con tu nutricionista.';

// GET /api/links/preview?code=XXXX
// Muestra a quién te vas a vincular antes de aceptar compartir tus datos.
async function previewLink(req, res) {
  const profile = await findByLinkCode(req.query.code);
  if (!profile) return res.status(404).json({ error: INVALID_CODE });
  const ratings = await ratingsFor([profile.id]);
  res.json({ nutritionist: publicCard(profile, ratings.get(profile.id)) });
}

// POST /api/links  { code, consent: true }
// Vinculación paciente–nutricionista. Un solo vínculo activo por paciente.
async function createLink(req, res) {
  if (req.body.consent !== true) {
    return res.status(422).json({ error: 'Tenés que aceptar compartir tu información con el nutricionista.' });
  }

  const current = await prisma.patientLink.findFirst({
    where: { patientId: req.user.id, status: 'ACTIVE' },
    include: { nutritionist: { include: withUser } },
  });
  if (current) {
    const name = current.nutritionist.user?.displayName || 'otro nutricionista';
    return res.status(409).json({ error: `Ya estás vinculado con ${name}. Para vincularte con otro, primero desvinculate.` });
  }

  const profile = await findByLinkCode(req.body.code);
  if (!profile) return res.status(404).json({ error: INVALID_CODE });

  try {
    await prisma.patientLink.create({ data: { patientId: req.user.id, nutritionistId: profile.id } });
  } catch (err) {
    // Índice único parcial: dos pedidos simultáneos no pueden crear dos vínculos activos.
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya tenés un nutricionista vinculado.' });
    }
    throw err;
  }

  logger.info(`Vínculo creado: paciente ${req.user.id} -> nutricionista ${profile.id}`);
  return getMyLink(req, res);
}

// GET /api/links/me
async function getMyLink(req, res) {
  const link = await prisma.patientLink.findFirst({
    where: { patientId: req.user.id, status: 'ACTIVE' },
    include: { nutritionist: { include: withUser } },
  });
  if (!link) return res.json({ link: null });

  const ratings = await ratingsFor([link.nutritionistId]);
  res.json({
    link: {
      id: link.id,
      since: link.createdAt,
      nutritionist: publicCard(link.nutritionist, ratings.get(link.nutritionistId)),
    },
  });
}

// DELETE /api/links/me
// El paciente se desvincula. El vínculo queda en el historial (ENDED) para
// que pueda seguir editando su valoración.
async function deleteMyLink(req, res) {
  const { count } = await prisma.patientLink.updateMany({
    where: { patientId: req.user.id, status: 'ACTIVE' },
    data: { status: 'ENDED', endedAt: new Date(), endedBy: 'PATIENT' },
  });
  if (!count) return res.status(404).json({ error: 'No tenés un nutricionista vinculado.' });
  logger.info(`Paciente ${req.user.id} se desvinculó de su nutricionista`);
  res.json({ link: null });
}

module.exports = { previewLink, createLink, getMyLink, deleteMyLink };

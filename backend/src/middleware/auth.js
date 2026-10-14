const { initFirebase, admin } = require('../config/firebase');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { ageFromBirthDate } = require('../utils/age');

initFirebase();

/**
 * Exige un Authorization: Bearer <idToken> válido emitido por Firebase.
 * - Nunca confía en un userId mandado por el cliente en el body/query.
 * - Adjunta req.user con el perfil de negocio ya cargado desde la DB.
 * - Si el usuario todavía no existe en la DB (primer login), lo crea
 *   con los datos básicos del token, sin datos biométricos todavía.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'No autenticado. Falta el token de sesión.' });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    let user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: decoded.uid,
          email: decoded.email,
          displayName: decoded.name || null,
          photoUrl: decoded.picture || null,
          provider: decoded.firebase?.sign_in_provider === 'google.com' ? 'GOOGLE' : 'EMAIL',
        },
      });
      logger.info(`Nuevo usuario creado: ${user.id}`);
    }

    // Cuenta suspendida por un Administrador.
    if (user.banned) {
      return res.status(403).json({ error: 'Tu cuenta está suspendida. Si creés que es un error, escribinos.', banned: true });
    }

    // Si el usuario cargó su fecha de nacimiento, la edad se mantiene
    // actualizada sola (se corrige en la base el día que cumple años).
    if (user.birthDate) {
      const age = ageFromBirthDate(user.birthDate);
      if (age !== user.age) {
        user = await prisma.user.update({ where: { id: user.id }, data: { age } });
      }
    }

    // Pro pago vencido (cancelado o sin cobro): vuelve al plan Gratuito.
    if (user.plan === 'PREMIUM' && user.planUntil && new Date(user.planUntil) <= new Date()) {
      user = await prisma.user.update({ where: { id: user.id }, data: { plan: 'FREE' } });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.warn(`Fallo de autenticación: ${err.message}`);
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

module.exports = { requireAuth };
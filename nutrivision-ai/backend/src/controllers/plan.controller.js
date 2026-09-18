const prisma = require('../config/prisma');
const logger = require('../utils/logger');

// Límite real del plan Gratuito: cantidad de platos que se pueden
// guardar por día. Se comparte con meal.controller.js.
const FREE_DAILY_SCAN_LIMIT = 3;

// GET /api/plan
// Devuelve el plan actual y el uso real del día, para que la pantalla
// de Precios pueda mostrar cuántos escaneos te quedan hoy.
async function getPlan(req, res) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const scansToday = await prisma.meal.count({
    where: { userId: req.user.id, loggedAt: { gte: startOfDay } },
  });

  res.json({
    plan: req.user.plan,
    freeDailyScanLimit: FREE_DAILY_SCAN_LIMIT,
    scansToday,
    scansRemaining: req.user.plan === 'PREMIUM'
      ? null // sin límite
      : Math.max(FREE_DAILY_SCAN_LIMIT - scansToday, 0),
  });
}

// PATCH /api/plan
// Cambia el plan del usuario. IMPORTANTE: esto NO procesa ningún pago —
// no hay pasarela de cobro integrada en el proyecto. Cambia el plan
// directamente en la base para poder probar y demostrar la diferencia
// real entre ambos planes (el límite diario de escaneos).
async function updatePlan(req, res) {
  const { plan } = req.body;

  if (!['FREE', 'PREMIUM'].includes(plan)) {
    return res.status(422).json({ error: 'Plan inválido.' });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { plan },
  });

  logger.info(`Plan de user ${user.id} cambiado a ${plan} (modo demo, sin cobro real)`);

  res.json({ user });
}

module.exports = { getPlan, updatePlan, FREE_DAILY_SCAN_LIMIT };

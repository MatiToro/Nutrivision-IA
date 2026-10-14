const prisma = require('../config/prisma');
const { isPremiumUser } = require('../utils/premium');

// Límite real del plan Gratuito: cantidad de platos que se pueden
// guardar por día. Se comparte con meal.controller.js.
const FREE_DAILY_SCAN_LIMIT = 3;

// GET /api/plan
// Devuelve el plan actual y el uso real del día, para que la pantalla
// de Precios pueda mostrar cuántos escaneos te quedan hoy.
async function getPlan(req, res) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Las comidas registradas desde una receta no son escaneos.
  const scansToday = await prisma.meal.count({
    where: { userId: req.user.id, loggedAt: { gte: startOfDay }, source: { not: 'RECIPE' } },
  });

  const isPremium = isPremiumUser(req.user);

  res.json({
    plan: req.user.plan,
    // Premium efectivo: plan pago o código de nutricionista vigente.
    isPremium,
    premiumUntil: req.user.premiumUntil,
    // Vencimiento del Pro pago con Mercado Pago (null = sin vencimiento).
    planUntil: req.user.plan === 'PREMIUM' ? req.user.planUntil : null,
    freeDailyScanLimit: FREE_DAILY_SCAN_LIMIT,
    scansToday,
    scansRemaining: isPremium
      ? null // sin límite
      : Math.max(FREE_DAILY_SCAN_LIMIT - scansToday, 0),
  });
}

module.exports = { getPlan, FREE_DAILY_SCAN_LIMIT };

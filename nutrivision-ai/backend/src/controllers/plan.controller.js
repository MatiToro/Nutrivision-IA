const prisma = require('../config/prisma');
const { isPremiumUser } = require('../utils/premium');

// Límite real del plan Gratuito: cantidad de FOTOS que se pueden analizar
// con IA por día. Se comparte con meal.controller.js.
const FREE_DAILY_SCAN_LIMIT = 3;

// Escaneos de hoy = fotos analizadas con IA (tabla ScanLog). Las comidas
// repetidas o registradas desde una receta no cuentan.
async function countScansToday(userId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.scanLog.count({ where: { userId, createdAt: { gte: startOfDay } } });
}

// GET /api/plan
// Devuelve el plan actual y el uso real del día, para que la pantalla
// de Precios pueda mostrar cuántos escaneos te quedan hoy.
async function getPlan(req, res) {
  const scansToday = await countScansToday(req.user.id);

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

module.exports = { getPlan, countScansToday, FREE_DAILY_SCAN_LIMIT };

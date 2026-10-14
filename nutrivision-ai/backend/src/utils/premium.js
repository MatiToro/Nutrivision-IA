// Pro pago vigente: plan = PREMIUM y, si tiene vencimiento (suscripción de
// Mercado Pago), todavía no llegó. planUntil = null => sin vencimiento.
function hasPaidPro(user, now = new Date()) {
  if (!user || user.plan !== 'PREMIUM') return false;
  return !user.planUntil || new Date(user.planUntil) > now;
}

// Premium "efectivo": el usuario tiene Premium si tiene el plan pago vigente
// o si canjeó un código de nutricionista que todavía no venció (premiumUntil).
function isPremiumUser(user, now = new Date()) {
  if (!user) return false;
  if (hasPaidPro(user, now)) return true;
  return Boolean(user.premiumUntil && new Date(user.premiumUntil) > now);
}

module.exports = { isPremiumUser, hasPaidPro };

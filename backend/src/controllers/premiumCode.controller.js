const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const { normalizeCode } = require('../utils/codes');
const { hasPaidPro } = require('../utils/premium');

// Cada código de nutricionista da 30 días de Premium.
const CODE_PREMIUM_DAYS = 30;

// POST /api/premium-codes/redeem  { code }
async function redeemCode(req, res) {
  const now = new Date();
  const user = req.user;

  if (hasPaidPro(user, now)) {
    return res.status(409).json({ error: 'Ya tenés NutriVision Pro activo: no necesitás canjear un código.' });
  }
  if (user.premiumUntil && new Date(user.premiumUntil) > now) {
    return res.status(409).json({ error: 'Ya tenés un código Premium activo. Vas a poder canjear otro cuando venza.' });
  }

  const code = normalizeCode(req.body.code);
  const premiumCode = code.length >= 4
    ? await prisma.premiumCode.findUnique({ where: { code } })
    : null;

  if (!premiumCode) return res.status(404).json({ error: 'El código no existe. Revisá que esté bien escrito.' });
  if (premiumCode.redeemedById) return res.status(409).json({ error: 'Este código ya fue usado.' });
  if (premiumCode.periodEnd <= now) return res.status(410).json({ error: 'Este código venció. Pedile uno nuevo a tu nutricionista.' });

  const premiumUntil = new Date(now.getTime() + CODE_PREMIUM_DAYS * 24 * 60 * 60 * 1000);

  const updated = await prisma.$transaction(async (tx) => {
    // updateMany con redeemedById: null => si dos personas canjean el mismo
    // código a la vez, solo una lo consigue.
    const { count } = await tx.premiumCode.updateMany({
      where: { id: premiumCode.id, redeemedById: null },
      data: { redeemedById: user.id, redeemedAt: now },
    });
    if (!count) return null;
    return tx.user.update({ where: { id: user.id }, data: { premiumUntil } });
  });

  if (!updated) return res.status(409).json({ error: 'Este código ya fue usado.' });

  logger.info(`Código Premium ${premiumCode.id} canjeado por ${user.id} (hasta ${premiumUntil.toISOString()})`);
  res.json({ user: updated, premiumUntil });
}

module.exports = { redeemCode, CODE_PREMIUM_DAYS };

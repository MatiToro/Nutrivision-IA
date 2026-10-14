const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { handleValidation } = require('../utils/validators');
const controller = require('../controllers/premiumCode.controller');

const router = Router();

const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos con códigos. Probá de nuevo en unos minutos.' },
});

// Canje de códigos Premium de nutricionistas.
router.post(
  '/redeem',
  requireAuth,
  requireRole('USER'),
  redeemLimiter,
  [body('code').isString().trim().isLength({ min: 4, max: 20 }).withMessage('Ingresá el código.')],
  handleValidation,
  controller.redeemCode,
);

module.exports = router;

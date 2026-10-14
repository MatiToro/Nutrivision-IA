const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { handleValidation } = require('../utils/validators');
const c = require('../controllers/payment.controller');

const router = Router();

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de suscripción. Probá de nuevo en unos minutos.' },
});

// Públicas: las llama Mercado Pago (notificaciones y vuelta del checkout).
router.post('/webhook', c.webhook);
router.get('/return', c.returnPage);

// Suscripciones del usuario (Pro mensual, Pro anual, Nutricionista)
router.get('/me', requireAuth, c.getMine);
router.post(
  '/subscriptions',
  requireAuth,
  createLimiter,
  [body('kind').isIn(['PRO_MONTHLY', 'PRO_ANNUAL', 'NUTRITIONIST']).withMessage('Plan inválido.')],
  handleValidation,
  c.createSubscription,
);
router.post('/subscriptions/:id/sync', requireAuth, [param('id').isUUID()], handleValidation, c.syncSubscription);
router.post('/subscriptions/:id/cancel', requireAuth, [param('id').isUUID()], handleValidation, c.cancelSubscription);

module.exports = router;

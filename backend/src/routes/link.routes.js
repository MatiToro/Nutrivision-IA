const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { handleValidation } = require('../utils/validators');
const controller = require('../controllers/link.controller');

const router = Router();

// Evita probar códigos al azar.
const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos con códigos. Probá de nuevo en unos minutos.' },
});

// Vinculación paciente–nutricionista. Solo cuentas de usuario (pacientes).
router.use(requireAuth, requireRole('USER'));

router.get('/me', controller.getMyLink);
router.delete('/me', controller.deleteMyLink);
router.get('/preview', codeLimiter, controller.previewLink);
router.post(
  '/',
  codeLimiter,
  [
    body('code').isString().trim().isLength({ min: 4, max: 20 }).withMessage('Ingresá el código de tu nutricionista.'),
    body('consent').isBoolean(),
  ],
  handleValidation,
  controller.createLink,
);

module.exports = router;

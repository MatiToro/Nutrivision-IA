const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { handleValidation } = require('../utils/validators');
const { isPremiumUser } = require('../utils/premium');
const controller = require('../controllers/recipe.controller');

const router = Router();

// Recetas inteligentes: solo pacientes con Premium efectivo
// (plan pago o código de nutricionista vigente). Se valida acá, en el servidor.
function requirePremium(req, res, next) {
  if (!isPremiumUser(req.user)) {
    return res.status(403).json({ error: 'Las recetas inteligentes son una función Premium.', premiumRequired: true });
  }
  next();
}

// Abrir recetas de FatSecret usa la IA para traducirlas.
const recipeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Estás abriendo recetas muy rápido. Esperá un momento.' },
});

router.use(requireAuth, requireRole('USER'), requirePremium);

const recipeKey = (chain) => chain.isString().matches(/^(ai-[0-9a-f-]{36}|fs-\d{1,15})$/).withMessage('Receta inválida.');

router.get('/usage', controller.getUsage);
router.post(
  '/suggest',
  [
    body('mealType').optional({ values: 'null' }).isIn(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).withMessage('Tipo de comida inválido.'),
    body('maxMinutes').optional({ values: 'null' }).isInt({ min: 5, max: 240 }).withMessage('Tiempo inválido.'),
    // 4 = "4 o más" (sin límite)
    body('maxMissing').optional().isInt({ min: 0, max: 4 }).withMessage('Cantidad de faltantes inválida.'),
    body('fitGoals').optional().isBoolean(),
  ],
  handleValidation,
  controller.suggest,
);

router.get('/saved', controller.listSaved);
router.post('/saved', [recipeKey(body('key'))], handleValidation, controller.saveRecipe);
router.delete('/saved/:key', [recipeKey(param('key'))], handleValidation, controller.unsaveRecipe);

router.post(
  '/log',
  [recipeKey(body('key')), body('portions').isFloat({ min: 0.25, max: 10 }).withMessage('Porciones inválidas (entre 0,25 y 10).')],
  handleValidation,
  controller.logRecipe,
);

router.get('/:key', recipeLimiter, [recipeKey(param('key'))], handleValidation, controller.getRecipe);

module.exports = router;

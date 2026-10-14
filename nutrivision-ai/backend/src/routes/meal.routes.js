const { Router } = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { mealAnalysisLimiter, mealEditLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const { handleValidation } = require('../utils/validators');
const mealController = require('../controllers/meal.controller');

const router = Router();

router.use(requireAuth);

// Carga de Imagen (Web y app mobile: cámara o galería): sube la foto y dispara
// el análisis por visión artificial + devolución del Coach IA.
// No guarda nada en la base todavía.
router.post(
  '/analyze',
  mealAnalysisLimiter,
  upload.single('image'),
  mealController.analyzeMeal,
);

// Recalcula los macros de un ingrediente al que el usuario le corrigió el
// nombre en el editor. No guarda nada.
router.post(
  '/ingredient-nutrition',
  mealEditLimiter,
  [
    body('name').isString().trim().isLength({ min: 2, max: 120 }),
    body('grams').isFloat({ min: 0, max: 3000 }),
  ],
  handleValidation,
  mealController.ingredientNutrition,
);

// Regenera la devolución del Coach IA después de editar ingredientes.
// No guarda nada.
router.post(
  '/coach',
  mealEditLimiter,
  [
    body('dishName').optional().isString().isLength({ max: 120 }),
    body('ingredients').isArray({ min: 1, max: 30 }),
    body('ingredients.*.name').isString().trim().isLength({ min: 1, max: 120 }),
    body('ingredients.*.grams').isFloat({ min: 0, max: 3000 }),
    body('ingredients.*.calories').isFloat({ min: 0, max: 5000 }),
    body('ingredients.*.proteinG').isFloat({ min: 0, max: 1000 }),
    body('ingredients.*.carbsG').isFloat({ min: 0, max: 1000 }),
    body('ingredients.*.fatG').isFloat({ min: 0, max: 1000 }),
  ],
  handleValidation,
  mealController.regenerateCoach,
);

// Confirmación final: acá sí se crea el registro en la base. Requiere
// un nombre no vacío (validado dentro del controller).
router.post(
  '/',
  upload.single('image'),
  mealController.createMeal,
);

router.get('/:id', [param('id').isUUID()], handleValidation, mealController.getMeal);

router.delete('/:id', [param('id').isUUID()], handleValidation, mealController.deleteMeal);

module.exports = router;

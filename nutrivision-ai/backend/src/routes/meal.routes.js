const { Router } = require('express');
const { param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { mealAnalysisLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const { handleValidation } = require('../utils/validators');
const mealController = require('../controllers/meal.controller');

const router = Router();

router.use(requireAuth);

// Carga de Imagen (Web): sube un archivo desde la computadora y dispara
// el análisis por visión artificial + devolución del Coach IA.
// No guarda nada en la base todavía.
router.post(
  '/analyze',
  mealAnalysisLimiter,
  upload.single('image'),
  mealController.analyzeMeal,
);

// Confirmación final: acá sí se crea el registro en la base. Requiere
// un nombre no vacío (validado dentro del controller, porque además
// del nombre viaja el archivo de imagen — multer ya parseó el multipart
// para cuando llegamos acá, así que la validación del "name" se hace
// a mano en el controller en vez de con express-validator).
router.post(
  '/',
  upload.single('image'),
  mealController.createMeal,
);

router.get('/:id', [param('id').isUUID()], handleValidation, mealController.getMeal);

router.delete('/:id', [param('id').isUUID()], handleValidation, mealController.deleteMeal);

module.exports = router;

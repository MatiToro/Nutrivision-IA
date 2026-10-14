const { Router } = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { handleValidation } = require('../utils/validators');
const controller = require('../controllers/nutritionist.controller');

const router = Router();

router.use(requireAuth);

// Directorio y perfil público
router.get('/', controller.listNutritionists);
router.get('/:id', [param('id').isUUID()], handleValidation, controller.getNutritionist);

// Valoraciones: solo pacientes actuales o anteriores
router.put(
  '/:id/review',
  requireRole('USER'),
  [
    param('id').isUUID(),
    body('stars').isInt({ min: 1, max: 5 }).withMessage('Elegí de 1 a 5 estrellas.'),
    body('comment').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }).withMessage('El comentario puede tener hasta 500 caracteres.'),
  ],
  handleValidation,
  controller.upsertReview,
);

module.exports = router;

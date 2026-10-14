const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { handleValidation } = require('../utils/validators');
const c = require('../controllers/admin.controller');

const router = Router();

// Panel de Administrador. Solo cuentas con rol ADMIN.
router.use(requireAuth, requireRole('ADMIN'));

router.get('/stats', c.getStats);

// Usuarios
router.get(
  '/users',
  [query('filter').optional().isIn(['ALL', 'USER', 'NUTRITIONIST', 'ADMIN', 'BANNED', 'PREMIUM'])],
  handleValidation,
  c.listUsers,
);
router.get('/users/:id', [param('id').isUUID()], handleValidation, c.getUser);
router.patch(
  '/users/:id',
  [
    param('id').isUUID(),
    body('role').optional().isIn(['USER', 'NUTRITIONIST', 'ADMIN']).withMessage('Rol inválido.'),
    body('plan').optional().isIn(['FREE', 'PREMIUM']).withMessage('Plan inválido.'),
    body('banned').optional().isBoolean().withMessage('Valor inválido.'),
  ],
  handleValidation,
  c.updateUser,
);

// Nutricionistas: solicitudes y aprobados
router.get(
  '/nutritionists',
  [query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED'])],
  handleValidation,
  c.listNutritionists,
);
router.get('/nutritionists/:id', [param('id').isUUID()], handleValidation, c.getNutritionist);
router.post('/nutritionists/:id/approve', [param('id').isUUID()], handleValidation, c.approveNutritionist);
router.post(
  '/nutritionists/:id/reject',
  [
    param('id').isUUID(),
    body('reason').isString().trim().isLength({ min: 5, max: 300 }).withMessage('Escribí el motivo del rechazo (entre 5 y 300 caracteres).'),
  ],
  handleValidation,
  c.rejectNutritionist,
);

module.exports = router;

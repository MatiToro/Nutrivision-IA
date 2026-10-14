const { Router } = require('express');
const { body, param } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { handleValidation } = require('../utils/validators');
const c = require('../controllers/nutritionistPanel.controller');

const router = Router();

// Panel del nutricionista. Solo cuentas con rol NUTRITIONIST.
router.use(requireAuth, requireRole('NUTRITIONIST'));

const optionalText = (field, max, msg) => body(field).optional({ values: 'null' }).isString().trim().isLength({ max }).withMessage(msg);

const profileValidation = [
  body('displayName').optional().isString().trim().isLength({ min: 3, max: 100 }).withMessage('Escribí tu nombre completo.'),
  optionalText('bio', 1000, 'La descripción puede tener hasta 1000 caracteres.'),
  body('specialties').optional().isArray({ max: 8 }).withMessage('Podés cargar hasta 8 especialidades.'),
  body('specialties.*').optional().isString().trim().isLength({ min: 2, max: 40 }).withMessage('Cada especialidad puede tener hasta 40 caracteres.'),
  body('contactWhatsapp').optional({ values: 'falsy' }).isString().trim()
    .matches(/^\+?[\d\s()-]{6,24}$/).withMessage('El WhatsApp tiene que ser un número de teléfono (con código de área).'),
  body('contactEmail').optional({ values: 'falsy' }).isEmail().withMessage('El correo de contacto no es válido.'),
  optionalText('contactInstagram', 60, 'El usuario de Instagram es demasiado largo.'),
  optionalText('contactOther', 200, 'El otro contacto puede tener hasta 200 caracteres.'),
];

// Mi cuenta
router.get('/me', c.getMe);
router.put(
  '/me/application',
  [
    body('licenseNumber').isString().trim().isLength({ min: 3, max: 30 }).withMessage('Ingresá tu número de matrícula.'),
    ...profileValidation,
  ],
  handleValidation,
  c.submitApplication,
);
router.patch('/me/profile', profileValidation, handleValidation, c.updateMyProfile);
router.get('/me/reviews', c.listMyReviews);
router.post('/me/link-code', c.regenerateLinkCode);
// La suscripción se contrata con Mercado Pago (/api/payments). Este DELETE solo
// cancela suscripciones antiguas, anteriores a Mercado Pago.
router.delete('/me/subscription', c.cancelSubscription);

// Pacientes
router.get('/patients', c.listPatients);
router.get('/patients/:id', [param('id').isUUID()], handleValidation, c.getPatient);
router.get('/patients/:id/meals', [param('id').isUUID()], handleValidation, c.listPatientMeals);
router.get('/patients/:id/meals/:mealId', [param('id').isUUID(), param('mealId').isUUID()], handleValidation, c.getPatientMeal);
router.patch(
  '/patients/:id/goals',
  [
    param('id').isUUID(),
    body('goal').optional().isIn(['LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE', 'GAIN_WEIGHT', 'MODIFY_DIET']),
    body('dailyCalorieGoal').optional().isInt({ min: 500, max: 8000 }).withMessage('Calorías: entre 500 y 8000.'),
    body('dailyProteinGoalG').optional().isInt({ min: 0, max: 500 }).withMessage('Proteínas: entre 0 y 500 g.'),
    body('dailyCarbsGoalG').optional().isInt({ min: 0, max: 900 }).withMessage('Carbohidratos: entre 0 y 900 g.'),
    body('dailyFatGoalG').optional().isInt({ min: 0, max: 400 }).withMessage('Grasas: entre 0 y 400 g.'),
  ],
  handleValidation,
  c.updatePatientGoals,
);
router.delete('/patients/:id', [param('id').isUUID()], handleValidation, c.removePatient);

module.exports = router;

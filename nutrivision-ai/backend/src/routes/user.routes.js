const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { handleValidation } = require('../utils/validators');
const userController = require('../controllers/user.controller');

const router = Router();

router.use(requireAuth);

const GOAL_VALUES = ['LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE', 'GAIN_WEIGHT', 'MODIFY_DIET'];

const onboardingValidation = [
  body('weightKg').isFloat({ min: 20, max: 400 }).withMessage('Peso inválido.'),
  body('heightCm').isFloat({ min: 80, max: 260 }).withMessage('Altura inválida.'),
  body('age').isInt({ min: 13, max: 100 }).withMessage('Edad inválida.'),
  body('sex').isIn(['MALE', 'FEMALE', 'OTHER']),
  body('activityLevel').isIn(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']),
  body('goal').isIn(GOAL_VALUES),
];

router.get('/me', userController.getProfile);
router.put('/me/onboarding', onboardingValidation, handleValidation, userController.completeOnboarding);
router.patch('/me', [
  body('weightKg').optional().isFloat({ min: 20, max: 400 }),
  body('heightCm').optional().isFloat({ min: 80, max: 260 }),
  body('age').optional().isInt({ min: 13, max: 100 }),
  body('sex').optional().isIn(['MALE', 'FEMALE', 'OTHER']),
  body('activityLevel').optional().isIn(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']),
  body('goal').optional().isIn(GOAL_VALUES),
  body('displayName').optional().isString().trim().isLength({ max: 100 }).escape(),
  // Metas diarias personalizadas (opcional, el usuario las puede ajustar a mano)
  body('dailyCalorieGoal').optional().isInt({ min: 500, max: 8000 }),
  body('dailyProteinGoalG').optional().isInt({ min: 0, max: 500 }),
  body('dailyCarbsGoalG').optional().isInt({ min: 0, max: 900 }),
  body('dailyFatGoalG').optional().isInt({ min: 0, max: 400 }),
], handleValidation, userController.updateProfile);

router.patch('/me/photo', upload.single('photo'), userController.uploadPhoto);

module.exports = router;

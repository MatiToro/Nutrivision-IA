const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { handleValidation } = require('../utils/validators');
const planController = require('../controllers/plan.controller');

const router = Router();

router.use(requireAuth);

router.get('/', planController.getPlan);
router.patch(
  '/',
  [body('plan').isIn(['FREE', 'PREMIUM'])],
  handleValidation,
  planController.updatePlan,
);

module.exports = router;

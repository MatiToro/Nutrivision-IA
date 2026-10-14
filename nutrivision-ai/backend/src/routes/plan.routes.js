const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const planController = require('../controllers/plan.controller');

const router = Router();

router.use(requireAuth);

router.get('/', planController.getPlan);
// El plan Pro solo se activa pagando con Mercado Pago (/api/payments) o con un
// código de nutricionista. Los administradores lo cambian desde /api/admin.

module.exports = router;

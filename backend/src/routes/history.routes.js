const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const historyController = require('../controllers/history.controller');

const router = Router();

router.use(requireAuth);

router.get('/meals', historyController.listMeals);
router.get('/summary', historyController.getSummary);

module.exports = router;
const { Router } = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const mealRoutes = require('./meal.routes');
const historyRoutes = require('./history.routes');
const planRoutes = require('./plan.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/meals', mealRoutes);
router.use('/history', historyRoutes);
router.use('/plan', planRoutes);

module.exports = router;

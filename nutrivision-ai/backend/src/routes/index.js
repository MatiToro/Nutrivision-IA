const { Router } = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const mealRoutes = require('./meal.routes');
const historyRoutes = require('./history.routes');
const planRoutes = require('./plan.routes');
const nutritionistRoutes = require('./nutritionist.routes');
const linkRoutes = require('./link.routes');
const premiumCodeRoutes = require('./premiumCode.routes');
const nutritionistPanelRoutes = require('./nutritionistPanel.routes');
const adminRoutes = require('./admin.routes');
const kitchenRoutes = require('./kitchen.routes');
const recipeRoutes = require('./recipe.routes');
const paymentRoutes = require('./payment.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/meals', mealRoutes);
router.use('/history', historyRoutes);
router.use('/plan', planRoutes);
// Módulo Nutricionistas (vista del paciente)
router.use('/nutritionists', nutritionistRoutes);
router.use('/links', linkRoutes);
router.use('/premium-codes', premiumCodeRoutes);
// Panel del nutricionista
router.use('/nutritionist', nutritionistPanelRoutes);
// Panel de Administrador
router.use('/admin', adminRoutes);
// Mi cocina: heladera y lista de compras
router.use('/kitchen', kitchenRoutes);
// Recetas inteligentes (Premium)
router.use('/recipes', recipeRoutes);
// Suscripciones con Mercado Pago
router.use('/payments', paymentRoutes);

module.exports = router;

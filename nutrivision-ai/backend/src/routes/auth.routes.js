const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = Router();

// El login/registro real (email+password o Google) lo hace el FRONTEND
// contra Firebase Authentication / Google Identity Services — el backend
// nunca ve ni guarda contraseñas. Esta ruta solo sincroniza/valida la
// sesión: si el token es válido, requireAuth ya crea el usuario en la
// primera llamada.
router.post('/session', authLimiter, requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
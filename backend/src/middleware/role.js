/**
 * Restringe una ruta a ciertos roles (USER, NUTRITIONIST, ADMIN).
 * Se usa siempre DESPUÉS de requireAuth (necesita req.user).
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Tu cuenta no tiene permiso para esta acción.' });
    }
    next();
  };
}

module.exports = { requireRole };

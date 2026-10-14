const rateLimit = require('express-rate-limit');

// Límite general para toda la API.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Probá de nuevo en unos minutos.' },
});

// Límite más estricto para el análisis de imágenes (llamadas a Gemini
// cuestan dinero y tiempo de proceso: hay que evitar abuso/spam).
const mealAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Estás escaneando platos muy rápido. Esperá un momento.' },
});

// Límite para las llamadas livianas a la IA durante la edición de un
// plato (recalcular un ingrediente, regenerar el Coach). Son más
// frecuentes que un escaneo, pero igual consumen cuota de Gemini.
const mealEditLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Estás haciendo demasiados cambios seguidos. Esperá un momento.' },
});

// Límite estricto para intentos de login/registro.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo más tarde.' },
});

module.exports = {
  apiLimiter, mealAnalysisLimiter, mealEditLimiter, authLimiter,
};
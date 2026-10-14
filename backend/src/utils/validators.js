const { validationResult } = require('express-validator');

/**
 * Corta la request si express-validator encontró algún problema en los
 * inputs. Se usa después de las cadenas de validación en cada ruta.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Datos inválidos.', details: errors.array() });
  }
  next();
}

module.exports = { handleValidation };
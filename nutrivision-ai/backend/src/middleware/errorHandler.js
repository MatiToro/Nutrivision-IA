const multer = require('multer');
const logger = require('../utils/logger');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err);

  if (err instanceof multer.MulterError || err.message?.includes('Formato de imagen')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'ZodError' || err.name === 'ValidationError') {
    return res.status(422).json({ error: 'Datos inválidos.', details: err.errors });
  }

  const status = err.status || 500;
  const message = status === 500 && env.isProduction
    ? 'Ocurrió un error interno. Ya estamos al tanto.'
    : err.message || 'Error interno del servidor.';

  res.status(status).json({ error: message });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado.' });
}

module.exports = { errorHandler, notFoundHandler };
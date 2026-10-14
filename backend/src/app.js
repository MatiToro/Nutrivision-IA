require('express-async-errors'); // permite usar async/await en controllers sin try/catch repetido
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();


app.set('trust proxy', 1);

// --- Seguridad de cabeceras HTTP ---
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// --- CORS restrictivo: solo los orígenes configurados en .env ---
app.use(cors({
  origin(origin, callback) {
    // Permite requests sin "origin" (curl, health checks) y los orígenes
    // explícitamente configurados. Cualquier otro queda bloqueado.
    if (!origin || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por la política de CORS.'));
  },
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(morgan(env.isProduction ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Rate limiting general para toda la API (límites más finos se aplican
// puntualmente en rutas sensibles como auth y análisis de imágenes).
app.use('/api', apiLimiter);

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
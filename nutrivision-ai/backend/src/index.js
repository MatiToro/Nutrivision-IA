const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
const { expirePlans } = require('./services/subscription.service');

const server = app.listen(env.port, () => {
  logger.info(`NutriVision AI backend escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
});

// Cada hora, los Pro pagos que vencieron (cancelados o sin cobro) vuelven a Gratuito.
const EXPIRE_EVERY_MS = 60 * 60 * 1000;
const expireTimer = setInterval(() => {
  expirePlans().catch((err) => logger.warn(`No se pudieron vencer planes: ${err.message}`));
}, EXPIRE_EVERY_MS);
expireTimer.unref();

// Apagado prolijo: deja terminar requests en curso antes de cerrar.
function shutdown(signal) {
  logger.info(`Señal ${signal} recibida. Cerrando servidor...`);
  server.close(() => {
    logger.info('Servidor cerrado correctamente.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
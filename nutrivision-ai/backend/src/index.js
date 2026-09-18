const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');

const server = app.listen(env.port, () => {
  logger.info(`NutriVision AI backend escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
});

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
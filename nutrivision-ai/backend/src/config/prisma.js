// Instancia única de Prisma Client. Evita abrir una conexión nueva por
// cada import (problema clásico con hot-reload / serverless).
const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: env.isProduction ? ['error', 'warn'] : ['warn'],
});

module.exports = prisma;
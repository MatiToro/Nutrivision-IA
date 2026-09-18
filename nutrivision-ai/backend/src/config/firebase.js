// Inicializa Firebase Admin SDK para poder VERIFICAR (no emitir) los
// tokens de sesión que el frontend obtiene de Firebase Authentication /
// Google Identity Services. El backend nunca maneja contraseñas.
const admin = require('firebase-admin');
const env = require('./env');
const logger = require('../utils/logger');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  const { projectId, clientEmail, privateKey } = env.firebase;

  if (!projectId || !clientEmail || !privateKey || privateKey.includes('CHANGE_ME')) {
    logger.warn('Firebase Admin no está configurado con credenciales reales. ' +
      'La verificación de sesión va a rechazar todos los tokens hasta que completes .env');
    initialized = true;
    return admin;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      // Las variables de entorno guardan "\n" como texto literal; hay que
      // convertirlo a salto de línea real para que la clave sea válida.
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });

  initialized = true;
  logger.info('Firebase Admin inicializado correctamente.');
  return admin;
}

module.exports = { initFirebase, admin };
// Carga y valida las variables de entorno una sola vez, al arrancar.
// Si falta algo crítico en producción, el servidor no debe levantar
// silenciosamente con una config incompleta.
require('dotenv').config();

const required = ['DATABASE_URL'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`[config] Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
  process.exit(1);
}

const optionalWithWarning = [
  'FIREBASE_PROJECT_ID',
  'GEMINI_API_KEY',
  'FATSECRET_CLIENT_ID',
];
optionalWithWarning.forEach((key) => {
  if (!process.env[key] || process.env[key].startsWith('your-')) {
    // eslint-disable-next-line no-console
    console.warn(`[config] "${key}" no está configurada con un valor real todavía. ` +
      'El servicio relacionado va a funcionar en modo simulado (mock).');
  }
});

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    isConfigured: Boolean(process.env.GEMINI_API_KEY) && !process.env.GEMINI_API_KEY.startsWith('your-'),
  },
  fatSecret: {
    clientId: process.env.FATSECRET_CLIENT_ID,
    clientSecret: process.env.FATSECRET_CLIENT_SECRET,
    isConfigured: Boolean(process.env.FATSECRET_CLIENT_ID) && !process.env.FATSECRET_CLIENT_ID.startsWith('your-'),
  },
  appJwtSecret: process.env.APP_JWT_SECRET || 'dev-only-insecure-secret-change-me',
  maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 5 * 1024 * 1024,
};
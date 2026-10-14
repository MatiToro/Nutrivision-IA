/* eslint-disable no-console */
// Crea (o convierte) una cuenta de ADMINISTRADOR.
//
// El Administrador no se registra desde la app: las contraseñas las guarda
// Firebase Authentication, así que este script:
//   1) crea el usuario en Firebase con correo y contraseña (si no existe), y
//   2) crea/actualiza su fila en PostgreSQL con role = ADMIN.
//
// Uso (desde la carpeta backend):
//   npm run crear-admin -- correo@ejemplo.com Contraseña "Nombre opcional"
// Si el correo ya existe en Firebase, se mantiene su contraseña actual;
// para cambiarla, agregár --reset-password al final.

const { initFirebase, admin } = require('../src/config/firebase');
const prisma = require('../src/config/prisma');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const args = process.argv.slice(2);
  const resetPassword = args.includes('--reset-password');
  const [emailArg, password, displayName = 'Administrador'] = args.filter((a) => a !== '--reset-password');
  const email = String(emailArg || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email) || !password) {
    console.error('Uso: npm run crear-admin -- correo@ejemplo.com Contraseña "Nombre opcional" [--reset-password]');
    process.exitCode = 1;
    return;
  }
  if (password.length < 6) {
    console.error('La contraseña tiene que tener al menos 6 caracteres (requisito de Firebase).');
    process.exitCode = 1;
    return;
  }

  initFirebase();
  if (!admin.apps.length) {
    console.error('Firebase Admin no está configurado (revisá FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en .env).');
    process.exitCode = 1;
    return;
  }

  // 1) Firebase Authentication
  let fbUser;
  try {
    fbUser = await admin.auth().getUserByEmail(email);
    if (resetPassword) {
      await admin.auth().updateUser(fbUser.uid, { password });
      console.log(`• Firebase: la cuenta ${email} ya existía, se actualizó la contraseña.`);
    } else {
      console.log(`• Firebase: la cuenta ${email} ya existía, se mantiene su contraseña (usá --reset-password para cambiarla).`);
    }
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    fbUser = await admin.auth().createUser({ email, password, displayName, emailVerified: true });
    console.log(`• Firebase: cuenta ${email} creada.`);
  }

  // 2) PostgreSQL (perfil con rol ADMIN)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ firebaseUid: fbUser.uid }, { email }] },
  });
  const user = existing
    ? await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', banned: false, firebaseUid: fbUser.uid, email },
    })
    : await prisma.user.create({
      data: {
        firebaseUid: fbUser.uid,
        email,
        displayName: fbUser.displayName || displayName,
        role: 'ADMIN',
      },
    });

  console.log(`• Base de datos: ${user.email} ahora es ADMIN (id ${user.id}).`);
  console.log('Listo. Iniciá sesión en la app con ese correo y contraseña.');
}

main()
  .catch((err) => {
    console.error('No se pudo crear el administrador:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

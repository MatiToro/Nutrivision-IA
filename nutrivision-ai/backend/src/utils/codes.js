const crypto = require('crypto');

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para que el código se pueda
// dictar o copiar a mano sin errores.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Normaliza lo que escribe el usuario: sin espacios ni guiones, en mayúsculas.
function normalizeCode(value) {
  return String(value || '').replace(/[\s-]/g, '').toUpperCase();
}

module.exports = { randomCode, normalizeCode };

const multer = require('multer');
const env = require('../config/env');

// Guardamos en memoria (no en disco) porque la imagen se reenvía a Gemini
// y se sube a un storage; no necesitamos persistirla en el filesystem
// del backend. Esto también evita path traversal / nombres de archivo
// maliciosos, ya que nunca escribimos el nombre original a disco.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Formato de imagen no soportado. Usá JPG, PNG o WEBP.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadBytes,
    files: 1,
  },
});

module.exports = upload;
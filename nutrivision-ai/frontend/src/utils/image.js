// Achica una foto antes de subirla (igual que la app mobile): el lado más largo
// queda en 1280 px y se guarda como JPEG. Sube mucho más rápido y a Gemini le
// alcanza esa resolución. Si algo falla, se sube la foto original.
const MAX_SIDE = 1280;
const QUALITY = 0.8;

export async function shrinkImage(file) {
  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    // Si ya es chica y liviana, no hace falta tocarla.
    if (scale === 1 && file.size < 600 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG con transparencia → fondo blanco en el JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || 'plato').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function loadBitmap(file) {
  if (window.createImageBitmap) {
    // imageOrientation: respeta la rotación EXIF de las fotos del celular
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

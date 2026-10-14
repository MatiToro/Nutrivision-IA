// Normalización de nombres de alimentos, compartida por la cocina (heladera y
// lista de compras) y las recetas: sin mayúsculas, sin tildes, sin palabras
// vacías y en singular. Así "Huevos" y "huevo" son lo mismo.

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'y', 'a', 'al', 'o', 'para', 'sin']);

// Plurales que la regla general no resuelve bien.
const IRREGULAR = {
  nueces: 'nuez', peces: 'pez', raices: 'raiz', lapices: 'lapiz', cruces: 'cruz', maices: 'maiz',
  arroces: 'arroz', voces: 'voz', ajies: 'aji', manies: 'mani',
};

// En español, las palabras terminadas en consonante forman el plural con "-es"
// (limón → limones, pan → panes) y las terminadas en vocal con "-s" (tomate → tomates).
const ES_PLURAL_STEM = /[lnrdjyx]$/;

function singular(w) {
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 4 && w.endsWith('es') && ES_PLURAL_STEM.test(w.slice(0, -2))) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** "Huevos" → "huevo", "Pechugas de Pollo" → "pechuga pollo", "Nueces" → "nuez". */
function normalizeFood(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singular)
    .join(' ');
}

module.exports = { normalizeFood, STOPWORDS };

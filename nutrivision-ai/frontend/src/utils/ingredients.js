// Helpers para manejar los ingredientes del escáner en memoria (antes de
// guardar el plato). Los campos que empiezan con "_" son solo del cliente
// y se quitan antes de mandar el plato al backend.
//
//  _uid      id estable de la fila (el índice cambia si se borra una fila)
//  _basis    valores de referencia { grams, calories, proteinG, carbsG, fatG }
//            a partir de los cuales se escalan los macros al cambiar los gramos.
//            Escalar SIEMPRE desde la referencia (y no desde el valor anterior)
//            evita que un ingrediente puesto en 0 g quede en 0 para siempre y
//            que se acumulen errores de redondeo.
//  _refName  nombre al que corresponden esos valores (si el usuario cambia el
//            nombre, se piden los macros nuevos a la IA)
//  _lookup   'pending' | 'error' mientras se recalcula por cambio de nombre
//  _lookupError  mensaje de error del último recálculo

const MACROS = ['calories', 'proteinG', 'carbsG', 'fatG'];

let uidCounter = 0;
export function newUid() {
  uidCounter += 1;
  return `ing-${Date.now().toString(36)}-${uidCounter}`;
}

export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function basisFrom(ing) {
  const grams = Number(ing.grams) || 0;
  if (grams <= 0) return null;
  return {
    grams,
    calories: Number(ing.calories) || 0,
    proteinG: Number(ing.proteinG) || 0,
    carbsG: Number(ing.carbsG) || 0,
    fatG: Number(ing.fatG) || 0,
  };
}

// Prepara un ingrediente recién llegado del análisis para poder editarlo.
export function withBasis(ing) {
  return {
    ...ing,
    _uid: ing._uid || newUid(),
    _basis: ing._basis !== undefined ? ing._basis : basisFrom(ing),
    _refName: ing._refName !== undefined ? ing._refName : String(ing.name || '').trim(),
  };
}

// Calcula los macros para "grams" a partir de la referencia.
export function scaleFromBasis(basis, grams) {
  const g = Number(grams) || 0;
  if (!basis || basis.grams <= 0) return null;
  const ratio = g / basis.grams;
  return Object.fromEntries(MACROS.map((m) => [m, round1(basis[m] * ratio)]));
}

// Actualiza la referencia con los valores actuales (para ingredientes
// cargados a mano, cuando el usuario edita sus macros directamente).
export function refreshBasis(ing) {
  return { ...ing, _basis: basisFrom(ing) };
}

// Quita los campos internos antes de mandar al backend.
export function stripClientFields(ing) {
  return Object.fromEntries(Object.entries(ing).filter(([key]) => !key.startsWith('_')));
}

// Firma para saber si los ingredientes cambiaron de verdad (y hace falta
// regenerar la devolución del Coach).
export function ingredientsSignature(list) {
  return JSON.stringify(list.map((i) => [
    String(i.name).trim().toLowerCase(), round1(i.grams), round1(i.calories),
    round1(i.proteinG), round1(i.carbsG), round1(i.fatG),
  ]));
}

export function sumIngredients(ingredients) {
  return ingredients.reduce((acc, ing) => ({
    totalCalories: acc.totalCalories + (Number(ing.calories) || 0),
    totalProteinG: acc.totalProteinG + (Number(ing.proteinG) || 0),
    totalCarbsG: acc.totalCarbsG + (Number(ing.carbsG) || 0),
    totalFatG: acc.totalFatG + (Number(ing.fatG) || 0),
  }), { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 });
}

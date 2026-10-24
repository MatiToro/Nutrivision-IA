const fatSecret = require('./fatsecret.service');
const logger = require('../utils/logger');

// ------------------------------------------------------------------
// Verificación de macros con FatSecret.
// Gemini detecta los ingredientes y estima gramos y macros. Después se busca
// cada ingrediente en FatSecret (base nutricional de referencia) por su nombre
// en inglés y, si los valores son razonables, se usan los de FatSecret.
// ------------------------------------------------------------------

// Rango aceptado entre las calorías de FatSecret y las de Gemini. Si la
// diferencia es mayor, lo más probable es que FatSecret haya encontrado otro
// alimento (ej. "milanesa" -> algo que no es), y se quedan los de Gemini.
const MIN_RATIO = 0.5;
const MAX_RATIO = 2;
// Ingredientes casi sin calorías (ej. lechuga, especias): se aceptan sin ratio.
const TINY_KCAL = 25;
// Ningún alimento tiene más de ~900 kcal cada 100 g.
const MAX_KCAL_PER_100G = 900;

const round1 = (n) => Math.round(n * 10) / 10;

function scaleTo(per100, grams) {
  const k = grams / 100;
  return {
    calories: Math.round(per100.calories * k),
    proteinG: round1(per100.proteinG * k),
    carbsG: round1(per100.carbsG * k),
    fatG: round1(per100.fatG * k),
  };
}

/** ¿Los valores de FatSecret son creíbles para este ingrediente? */
function isPlausible(aiCalories, fsCalories, per100) {
  if (!(per100.calories >= 0) || per100.calories > MAX_KCAL_PER_100G) return false;
  if (aiCalories <= TINY_KCAL && fsCalories <= TINY_KCAL) return true;
  if (aiCalories <= 0) return fsCalories <= TINY_KCAL;
  const ratio = fsCalories / aiCalories;
  return ratio >= MIN_RATIO && ratio <= MAX_RATIO;
}

/**
 * Devuelve el ingrediente con los macros verificados. Agrega:
 *  - nutritionSource: 'FATSECRET' (se usaron los datos de FatSecret) o 'AI' (quedó lo de Gemini)
 *  - fatSecretFoodId: id del alimento de FatSecret usado (o null)
 */
function applyMatch(ing, match) {
  const { englishName, ...base } = ing;
  if (!match || !(base.grams > 0)) return { ...base, fatSecretFoodId: null, nutritionSource: 'AI' };
  const fs = scaleTo(match.per100, base.grams);
  if (!isPlausible(Number(base.calories) || 0, fs.calories, match.per100)) {
    logger.debug(`FatSecret descartado para "${base.name}" ("${match.foodName}"): ${fs.calories} kcal vs IA ${base.calories} kcal`);
    return { ...base, fatSecretFoodId: null, nutritionSource: 'AI' };
  }
  return { ...base, ...fs, fatSecretFoodId: match.fatSecretFoodId, nutritionSource: 'FATSECRET' };
}

/**
 * Verifica una lista de ingredientes en paralelo. Nunca falla: si FatSecret
 * no responde, devuelve los ingredientes con los valores de Gemini.
 */
async function verifyIngredients(ingredients) {
  const list = Array.isArray(ingredients) ? ingredients : [];
  const checked = await Promise.all(list.map(async (ing) => {
    try {
      const query = ing.englishName || ing.name;
      const match = await fatSecret.findFoodNutrition(query);
      return applyMatch(ing, match);
    } catch (err) {
      logger.warn(`Verificación con FatSecret falló para "${ing.name}": ${err.message}`);
      return applyMatch(ing, null);
    }
  }));
  if (list.length) {
    const used = checked.filter((i) => i.nutritionSource === 'FATSECRET').length;
    logger.info(`FatSecret verificó ${used}/${list.length} ingrediente(s)`);
  }
  return checked;
}

module.exports = { verifyIngredients, applyMatch, isPlausible, scaleTo };

const env = require('../config/env');
const logger = require('../utils/logger');
const { generateWithFallback, GOAL_LABELS } = require('./gemini.service');

// ------------------------------------------------------------------
// IA para Recetas inteligentes:
//  1) generateAiRecipes: crea recetas con lo que hay en la heladera y,
//     en la misma llamada, traduce la heladera al inglés para buscar
//     recetas en FatSecret (que está en inglés).
//  2) translateFatSecretRecipes: traduce recetas de FatSecret al español.
// Nunca se inventan datos si la IA no está configurada.
// ------------------------------------------------------------------

const INGREDIENT = {
  type: 'OBJECT',
  properties: {
    text: { type: 'STRING' }, // cómo se lee en la receta: "2 huevos", "1 taza de arroz (200 g)"
    name: { type: 'STRING' }, // nombre corto y genérico en singular: "huevo", "arroz"
    quantity: { type: 'STRING' }, // "2 unidades", "200 g"
    pantry: { type: 'BOOLEAN' }, // básico de despensa (sal, aceite, agua...)
  },
  required: ['text', 'name', 'quantity', 'pantry'],
};

const MACROS = {
  type: 'OBJECT',
  properties: {
    calories: { type: 'NUMBER' },
    proteinG: { type: 'NUMBER' },
    carbsG: { type: 'NUMBER' },
    fatG: { type: 'NUMBER' },
  },
  required: ['calories', 'proteinG', 'carbsG', 'fatG'],
};

const AI_RECIPES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recipes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          prepMinutes: { type: 'NUMBER' },
          servings: { type: 'NUMBER' },
          perServing: MACROS,
          ingredients: { type: 'ARRAY', items: INGREDIENT },
          steps: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['name', 'description', 'prepMinutes', 'servings', 'perServing', 'ingredients', 'steps'],
      },
    },
    fridgeEnglish: { type: 'ARRAY', items: { type: 'STRING' } },
    searchTerms: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['recipes', 'fridgeEnglish', 'searchTerms'],
};

const TRANSLATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recipes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          ingredients: { type: 'ARRAY', items: INGREDIENT },
          steps: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['id', 'name', 'description', 'ingredients'],
      },
    },
  },
  required: ['recipes'],
};

const MEAL_TYPE_LABELS = {
  BREAKFAST: 'desayuno o merienda',
  LUNCH: 'almuerzo',
  DINNER: 'cena',
  SNACK: 'colación / snack',
};

const INGREDIENT_RULES = `Para cada ingrediente devolvé:
- text: cómo se lee en la receta, en español rioplatense y con medidas métricas o caseras (ej. "2 huevos", "1 taza de arroz (200 g)", "1 cda de aceite de oliva").
- name: nombre corto y genérico en singular y en minúscula, sin cantidades ni marcas (ej. "huevo", "arroz", "pechuga de pollo", "queso").
- quantity: solo la cantidad, máximo 30 caracteres (ej. "2 unidades", "200 g", "1 taza").
- pantry: true SOLO para básicos de despensa que casi todos tienen: sal, pimienta, aceite, agua, azúcar, vinagre, especias y hierbas secas. Todo lo demás, false.`;

function aiUnavailable() {
  const err = new Error('Las recetas necesitan la IA configurada en el servidor (GEMINI_API_KEY).');
  err.status = 503;
  return err;
}

function friendlyAiError(err, what) {
  logger.error(`Error de IA (${what}): ${err.message}`);
  const friendly = new Error(err.httpStatus === 429
    ? 'Se alcanzó el límite de uso de la IA por ahora. Esperá un minuto y probá de nuevo.'
    : `No pudimos ${what} en este momento. Probá de nuevo.`);
  friendly.status = err.httpStatus === 429 ? 429 : 502;
  return friendly;
}

const r0 = (n) => Math.round(Number(n) || 0);

/**
 * @param {object} p
 * @param {Array<{name, quantity}>} p.fridge
 * @param {object} p.user        usuario (objetivo)
 * @param {object|null} p.remaining  { calories, proteinG, carbsG, fatG } que le quedan hoy (si pidió "encajar en mis metas")
 * @param {object} p.filters     { mealType, maxMinutes, maxMissing }
 */
async function generateAiRecipes({ fridge, user, remaining, filters }) {
  if (!env.gemini.isConfigured) throw aiUnavailable();

  const fridgeList = fridge.map((f, i) => `${i + 1}. ${f.name}${f.quantity ? ` (${f.quantity})` : ''}`).join('\n');
  const constraints = [
    filters.mealType ? `- Tipo de comida: ${MEAL_TYPE_LABELS[filters.mealType]}.` : '- Cualquier comida del día.',
    filters.maxMinutes ? `- Tiempo total de preparación: como máximo ${filters.maxMinutes} minutos.` : null,
    filters.maxMissing >= 4
      ? '- Pueden usar varios ingredientes que NO estén en la heladera (4 o más), pero aprovechá lo más posible lo que hay.'
      : filters.maxMissing === 0
        ? '- Solo pueden usar lo que está en la heladera (más básicos de despensa): ningún ingrediente que falte.'
        : `- Cada receta puede usar como máximo ${filters.maxMissing} ingrediente(s) que NO estén en la heladera (los básicos de despensa no cuentan).`,
    user.goal ? `- Objetivo del usuario: ${GOAL_LABELS[user.goal] || user.goal}. Las recetas tienen que ayudar a ese objetivo.` : null,
    remaining
      ? `- Una porción tiene que entrar en lo que le queda hoy: ${r0(remaining.calories)} kcal, ${r0(remaining.proteinG)} g de proteína, ${r0(remaining.carbsG)} g de carbohidratos, ${r0(remaining.fatG)} g de grasas.`
      : null,
  ].filter(Boolean).join('\n');

  const prompt = `Sos un cocinero y nutricionista argentino. Proponé 4 recetas caseras, realistas y variadas
que se puedan cocinar principalmente con lo que el usuario tiene en su heladera.

HELADERA DEL USUARIO:
${fridgeList}

CONDICIONES:
${constraints}

Para cada receta:
- name: nombre atractivo y corto, en español rioplatense.
- description: una frase.
- prepMinutes: minutos totales (preparación + cocción).
- servings: cantidad de porciones.
- perServing: calorías (kcal), proteínas, carbohidratos y grasas (g) de UNA porción, con valores de tablas nutricionales estándar. Coherentes: calorías ≈ 4*proteína + 4*carbohidratos + 9*grasa.
- ingredients: todos los ingredientes de la receta completa (también los que falten).
- steps: pasos claros y breves, en orden (sin numerarlos).

${INGREDIENT_RULES}

Además:
- fridgeEnglish: el nombre en inglés de cada alimento de la heladera, en el MISMO orden (una o dos palabras, ej. "egg", "chicken breast", "cheese").
- searchTerms: 2 o 3 palabras en inglés con los alimentos principales de la heladera para buscar recetas (ej. "chicken", "egg").`;

  let parsed;
  try {
    parsed = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json', responseSchema: AI_RECIPES_SCHEMA },
    });
  } catch (err) {
    throw friendlyAiError(err, 'generar recetas');
  }

  return {
    recipes: Array.isArray(parsed.recipes) ? parsed.recipes.slice(0, 5) : [],
    fridgeEnglish: Array.isArray(parsed.fridgeEnglish) ? parsed.fridgeEnglish.map((s) => String(s).toLowerCase().trim()).filter(Boolean) : [],
    searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms.map((s) => String(s).trim()).filter(Boolean).slice(0, 3) : [],
  };
}

/**
 * Traduce recetas de FatSecret al español.
 * @param {Array<{id, name, description, ingredients: string[], steps?: string[]}>} recipes
 * @param {boolean} withSteps
 * @returns {Promise<Map<string, {name, description, ingredients, steps}>>}
 */
async function translateFatSecretRecipes(recipes, withSteps) {
  if (!env.gemini.isConfigured) throw aiUnavailable();
  if (!recipes.length) return new Map();

  const input = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    ingredients: r.ingredients,
    ...(withSteps ? { steps: r.steps || [] } : {}),
  }));

  const prompt = `Traducí estas recetas de FatSecret (Estados Unidos) al español rioplatense.
Mantené el mismo "id" de cada receta y el mismo orden de ingredientes${withSteps ? ' y de pasos' : ''}.
Pasá las medidas estadounidenses a medidas caseras o métricas (ej. "1 cup rice" → "1 taza de arroz (200 g)",
"8 oz chicken" → "230 g de pollo", "1 tbsp" → "1 cda", "°F" → "°C").
- name: nombre natural en español (no traducción literal si suena raro).
- description: una frase en español.
${withSteps ? '- steps: cada paso traducido, claro y breve, sin numerarlos.\n' : '- steps: devolvé una lista vacía.\n'}
${INGREDIENT_RULES}

RECETAS (JSON):
${JSON.stringify(input)}`;

  let parsed;
  try {
    parsed = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: TRANSLATION_SCHEMA },
    });
  } catch (err) {
    throw friendlyAiError(err, 'traducir las recetas de FatSecret');
  }

  const out = new Map();
  for (const t of Array.isArray(parsed.recipes) ? parsed.recipes : []) {
    if (t && t.id != null) out.set(String(t.id), t);
  }
  return out;
}

module.exports = { generateAiRecipes, translateFatSecretRecipes, MEAL_TYPE_LABELS };

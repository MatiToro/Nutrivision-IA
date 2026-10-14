const env = require('../config/env');
const logger = require('../utils/logger');

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const SEARCH_URL = 'https://platform.fatsecret.com/rest/foods/search/v1';
const RECIPE_SEARCH_URL = 'https://platform.fatsecret.com/rest/recipes/search/v3';
const RECIPE_GET_URL = 'https://platform.fatsecret.com/rest/recipe/v2';
const REQUEST_TIMEOUT_MS = 12_000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;


//Cacheamos el token en memoria hasta que expire para no pedir uno nuevo en cada request
async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const basicAuth = Buffer.from(
    `${env.fatSecret.clientId}:${env.fatSecret.clientSecret}`,
  ).toString('base64');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!response.ok) {
    throw new Error(`FatSecret token request falló: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Busca un alimento por nombre para contrastar/enriquecer lo detectado
 * por Gemini contra una base nutricional de referencia.
 * Devuelve null si el servicio no está configurado o falla — el resto
 * del flujo funciona igual usando solo la estimación de Gemini.
 */
async function searchFood(name) {
  if (!env.fatSecret.isConfigured) {
    return null;
  }

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({ search_expression: name, format: 'json', max_results: '1' });

    const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      logger.warn(`FatSecret search no-OK (${response.status}) para "${name}"`);
      return null;
    }

    const data = await response.json();
    const food = data.foods?.food?.[0] ?? null;
    return food ? { fatSecretFoodId: food.food_id, description: food.food_description } : null;
  } catch (err) {
    logger.warn(`FatSecret search falló para "${name}": ${err.message}`);
    return null;
  }
}

// ------------------------------------------------------------------
// Recetas. Las recetas de FatSecret están en inglés (región US;
// otras regiones son exclusivas del plan Premier). Se traducen con IA en
// services/recipe.service.js.
// Condiciones de FatSecret: solo el recipe_id se puede guardar para
// siempre; el resto de los datos, como máximo 24 horas.
// ------------------------------------------------------------------

// FatSecret convierte XML a JSON: una lista con un solo elemento llega como objeto en vez de array.
const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

class FatSecretError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// El error 21 significa que la IP del servidor no está habilitada en la cuenta de FatSecret.
let lastIpWarning = 0;
function warnIfIpBlocked(err) {
  if (err.code !== 21 || Date.now() - lastIpWarning < 10 * 60 * 1000) return;
  lastIpWarning = Date.now();
  logger.warn('FatSecret rechazó la IP de este servidor. Agregala en platform.fatsecret.com → '
    + '"Generate / View API Keys" → "IP Restrictions" (la IP aparece en el mensaje de arriba).');
}

async function getJson(url, params) {
  const token = await getAccessToken();
  const qs = new URLSearchParams({ ...params, format: 'json' });
  const response = await fetch(`${url}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new FatSecretError(`HTTP ${response.status}`);
  if (data?.error) throw new FatSecretError(`código ${data.error.code}: ${data.error.message}`, Number(data.error.code));
  return data;
}

/**
 * Busca recetas por texto (en inglés). Si FatSecret no está configurado o falla
 * devuelve { recipes: [], error }: las recetas de IA siguen funcionando igual.
 * @param {string} expression  ej. "chicken"
 * @param {object} [filters]   { recipeType, maxMinutes, maxCalories, maxResults }
 * @returns {Promise<{ recipes: Array, error: string|null }>}
 */
async function searchRecipes(expression, filters = {}) {
  if (!env.fatSecret.isConfigured) return { recipes: [], error: null };
  const params = {
    search_expression: expression,
    max_results: String(filters.maxResults || 20),
  };
  if (filters.recipeType) params.recipe_types = filters.recipeType;
  if (filters.maxMinutes) params['prep_time.to'] = String(filters.maxMinutes);
  if (filters.maxCalories) params['calories.to'] = String(filters.maxCalories);

  try {
    const data = await getJson(RECIPE_SEARCH_URL, params);
    const recipes = asArray(data?.recipes?.recipe).map((r) => ({
      id: String(r.recipe_id),
      name: String(r.recipe_name || ''),
      description: String(r.recipe_description || ''),
      imageUrl: typeof r.recipe_image === 'string' ? r.recipe_image : null,
      ingredients: asArray(r.recipe_ingredients?.ingredient).map(String),
      perServing: {
        calories: toNum(r.recipe_nutrition?.calories),
        proteinG: toNum(r.recipe_nutrition?.protein),
        carbsG: toNum(r.recipe_nutrition?.carbohydrate),
        fatG: toNum(r.recipe_nutrition?.fat),
      },
    })).filter((r) => r.id && r.name);
    return { recipes, error: null };
  } catch (err) {
    logger.warn(`FatSecret recipes.search falló para "${expression}": ${err.message}`);
    warnIfIpBlocked(err);
    return { recipes: [], error: err.code === 21 ? 'IP_BLOCKED' : 'FAILED' };
  }
}

/**
 * Detalle de una receta de FatSecret (en inglés). Devuelve null si no existe
 * o si el servicio falla.
 */
async function getRecipe(recipeId) {
  if (!env.fatSecret.isConfigured) return null;
  try {
    const data = await getJson(RECIPE_GET_URL, { recipe_id: String(recipeId) });
    const r = data?.recipe;
    if (!r) return null;
    const serving = asArray(r.serving_sizes?.serving)[0] || {};
    const prep = toNum(r.preparation_time_min);
    const cook = toNum(r.cooking_time_min);
    return {
      id: String(r.recipe_id),
      name: String(r.recipe_name || ''),
      description: String(r.recipe_description || ''),
      url: typeof r.recipe_url === 'string' ? r.recipe_url : null,
      imageUrl: asArray(r.recipe_images?.recipe_image).find((u) => typeof u === 'string') || null,
      servings: toNum(r.number_of_servings) || 1,
      gramsPerPortion: toNum(r.grams_per_portion),
      prepMinutes: prep,
      cookMinutes: cook,
      ingredients: asArray(r.ingredients?.ingredient)
        .map((i) => String(i.ingredient_description || i.food_name || ''))
        .filter(Boolean),
      steps: asArray(r.directions?.direction)
        .sort((a, b) => Number(a.direction_number) - Number(b.direction_number))
        .map((d) => String(d.direction_description || ''))
        .filter(Boolean),
      perServing: {
        calories: toNum(serving.calories),
        proteinG: toNum(serving.protein),
        carbsG: toNum(serving.carbohydrate),
        fatG: toNum(serving.fat),
      },
    };
  } catch (err) {
    logger.warn(`FatSecret recipe.get falló para ${recipeId}: ${err.message}`);
    warnIfIpBlocked(err);
    return null;
  }
}

module.exports = { searchFood, searchRecipes, getRecipe };
const crypto = require('crypto');
const prisma = require('../config/prisma');
const env = require('../config/env');
const logger = require('../utils/logger');
const fatSecret = require('../services/fatsecret.service');
const { generateCoachFeedback } = require('../services/gemini.service');
const { generateAiRecipes, translateFatSecretRecipes } = require('../services/recipeAi.service');
const recipes = require('../services/recipe.service');

/**
 * Recetas inteligentes (Premium). Una sola lista con dos
 * orígenes: recetas generadas por IA con la heladera y recetas reales de
 * FatSecret traducidas al español.
 */

const DAILY_LIMIT = 10; // sugerencias con IA por día y por usuario
const CACHE_MS = 6 * 60 * 60 * 1000; // misma heladera y filtros → mismas sugerencias por 6 h
const MAX_SAVED = 50;
const MAX_FATSECRET = 5; // recetas de FatSecret por sugerencia

// Tipo de comida → tipo de receta de FatSecret
const FATSECRET_TYPES = { BREAKFAST: 'Breakfast', LUNCH: 'Main Dish', DINNER: 'Main Dish', SNACK: 'Snack' };

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

async function usedToday(userId) {
  return prisma.recipeSuggestion.count({ where: { userId, createdAt: { gte: startOfToday() } } });
}

async function savedKeys(userId) {
  const rows = await prisma.savedRecipe.findMany({ where: { userId }, select: { recipeKey: true } });
  return new Set(rows.map((r) => r.recipeKey));
}

const listFridge = (userId) =>
  prisma.fridgeItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { name: true, quantity: true } });

function readFilters(body) {
  return {
    mealType: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].includes(body.mealType) ? body.mealType : null,
    maxMinutes: body.maxMinutes ? Number(body.maxMinutes) : null,
    // 4 = "4 o más": sin límite de ingredientes faltantes.
    maxMissing: body.maxMissing === undefined ? 3 : Number(body.maxMissing),
    fitGoals: body.fitGoals === true,
  };
}

/** Lo que le queda hoy de su meta (null si no tiene metas o ya se pasó). */
async function remainingToday(user) {
  if (!user.dailyCalorieGoal) return null;
  const eaten = await recipes.todayIntake(user.id);
  const calories = user.dailyCalorieGoal - eaten.totalCalories;
  if (calories < 150) return null;
  return {
    calories,
    proteinG: Math.max((user.dailyProteinGoalG || 0) - eaten.totalProteinG, 0),
    carbsG: Math.max((user.dailyCarbsGoalG || 0) - eaten.totalCarbsG, 0),
    fatG: Math.max((user.dailyFatGoalG || 0) - eaten.totalFatG, 0),
  };
}

/**
 * Busca en FatSecret con las palabras en inglés, se queda con las recetas que
 * más ingredientes comparten con la heladera y las traduce al español.
 */
async function fatSecretSuggestions({ searchTerms, fridgeEnglish, filters, remaining }) {
  if (!env.fatSecret.isConfigured || !searchTerms.length) return { list: [], error: null };

  const searchFilters = {
    recipeType: filters.mealType ? FATSECRET_TYPES[filters.mealType] : null,
    maxMinutes: filters.maxMinutes,
    maxCalories: remaining ? Math.round(remaining.calories) : null,
    maxResults: 20,
  };
  const responses = await Promise.all(searchTerms.map((t) => fatSecret.searchRecipes(t, searchFilters)));
  const results = responses.map((r) => r.recipes);
  // Si fallaron todas las búsquedas, se avisa en la app (y no se guarda en caché).
  if (responses.every((r) => r.error)) {
    return { list: [], error: 'Esta vez no se pudieron traer recetas de FatSecret. Te mostramos las de IA.' };
  }

  // Sin repetidas y ordenadas por cuántos alimentos de la heladera aparecen en sus ingredientes.
  const seen = new Set();
  const terms = fridgeEnglish.filter((t) => t.length >= 3);
  const scored = [];
  for (const r of results.flat()) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const text = r.ingredients.join(' | ').toLowerCase();
    const score = terms.filter((t) => text.includes(t)).length;
    if (score > 0 && r.ingredients.length) scored.push({ r, score: score / r.ingredients.length + score });
  }
  scored.sort((a, b) => b.score - a.score);
  // Se traducen algunas de más porque después se filtran por "ingredientes que faltan".
  const top = scored.slice(0, MAX_FATSECRET + 3).map((s) => s.r);
  if (!top.length) return { list: [], error: null };

  try {
    const translations = await translateFatSecretRecipes(top, false);
    return { list: top.map((r) => recipes.fromFatSecret(r, translations.get(r.id), false)), error: null };
  } catch (err) {
    logger.warn(`No se pudieron traducir las recetas de FatSecret: ${err.message}`);
    return { list: [], error: 'No se pudieron traer las recetas de FatSecret esta vez.' };
  }
}

/** Arma la lista final (una sola, con etiqueta de origen) con la heladera actual. */
function buildList(stored, fridge, keys, maxMissing) {
  const limit = maxMissing >= 4 ? Infinity : maxMissing;
  const matched = stored.map((r) => recipes.withMatch(r, fridge, keys));
  const ai = matched.filter((r) => r.source === 'AI');
  const fs = matched
    .filter((r) => r.source === 'FATSECRET' && r.missingCount <= limit)
    .sort((a, b) => a.missingCount - b.missingCount)
    .slice(0, MAX_FATSECRET);
  // Primero las que menos ingredientes necesitan comprar; a igualdad, las de IA.
  return [...ai, ...fs].sort((a, b) => a.missingCount - b.missingCount || (a.source === 'AI' ? -1 : 1));
}

// GET /api/recipes/usage → cuántas sugerencias le quedan hoy
async function getUsage(req, res) {
  const [used, fridgeCount] = await Promise.all([
    usedToday(req.user.id),
    prisma.fridgeItem.count({ where: { userId: req.user.id } }),
  ]);
  res.json({ dailyLimit: DAILY_LIMIT, remainingToday: Math.max(DAILY_LIMIT - used, 0), fridgeCount, fatsecretAvailable: env.fatSecret.isConfigured });
}

// POST /api/recipes/suggest { mealType?, maxMinutes?, maxMissing?, fitGoals? }
async function suggest(req, res) {
  const user = req.user;
  const filters = readFilters(req.body);
  await recipes.purgeExpired();

  const fridge = await listFridge(user.id);
  if (!fridge.length) {
    return res.status(409).json({ error: 'Tu heladera está vacía. Agregá los alimentos que tenés para recibir recetas.' });
  }

  const remaining = filters.fitGoals ? await remainingToday(user) : null;
  // Misma heladera + mismos filtros (+ lo que le queda hoy, redondeado) → mismas sugerencias.
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({
    fridge: fridge.map((f) => `${recipes.normalize(f.name)}|${f.quantity || ''}`).sort(),
    filters,
    remaining: remaining ? Math.round(remaining.calories / 100) : null,
  })).digest('hex');

  const [used, keys] = await Promise.all([usedToday(user.id), savedKeys(user.id)]);
  const cached = await prisma.recipeSuggestion.findFirst({
    where: { userId: user.id, requestHash, createdAt: { gte: new Date(Date.now() - CACHE_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  if (cached) {
    return res.json({
      recipes: buildList(cached.recipes, fridge, keys, filters.maxMissing),
      fromCache: true,
      dailyLimit: DAILY_LIMIT,
      remainingToday: Math.max(DAILY_LIMIT - used, 0),
      fatsecret: { available: env.fatSecret.isConfigured, error: null },
    });
  }

  if (used >= DAILY_LIMIT) {
    return res.status(429).json({
      error: `Llegaste al límite de ${DAILY_LIMIT} sugerencias de recetas por hoy. Mañana podés pedir más.`,
      limitReached: true,
      remainingToday: 0,
    });
  }

  const ai = await generateAiRecipes({ fridge, user, remaining, filters });
  const aiRecipes = ai.recipes.map(recipes.fromAi).filter((r) => r.name && r.ingredients.length);
  const fs = await fatSecretSuggestions({ searchTerms: ai.searchTerms, fridgeEnglish: ai.fridgeEnglish, filters, remaining });

  const stored = [...aiRecipes, ...fs.list];
  if (!stored.length) {
    return res.status(502).json({ error: 'No pudimos generar recetas esta vez. Probá de nuevo.' });
  }
  // Solo cuenta para el límite si la IA respondió bien. Si FatSecret falló, se guarda con
  // otra clave para que la próxima búsqueda igual no reuse este resultado incompleto.
  await prisma.recipeSuggestion.create({
    data: { userId: user.id, requestHash: fs.error ? `${requestHash}:sin-fatsecret` : requestHash, recipes: stored },
  });

  res.json({
    recipes: buildList(stored, fridge, keys, filters.maxMissing),
    fromCache: false,
    dailyLimit: DAILY_LIMIT,
    remainingToday: Math.max(DAILY_LIMIT - used - 1, 0),
    fatsecret: { available: env.fatSecret.isConfigured, error: fs.error },
  });
}

// GET /api/recipes/:key → detalle (las de FatSecret se piden y traducen acá)
async function getRecipe(req, res) {
  const recipe = await recipes.findRecipe(req.user.id, req.params.key);
  if (!recipe) {
    return res.status(404).json({
      error: req.params.key.startsWith('ai-')
        ? 'Esta receta ya no está disponible. Las sugerencias duran 24 horas: guardala para tenerla siempre.'
        : 'No encontramos esta receta en FatSecret.',
    });
  }
  const [fridge, keys] = await Promise.all([listFridge(req.user.id), savedKeys(req.user.id)]);
  res.json({ recipe: recipes.withMatch(recipe, fridge, keys) });
}

// GET /api/recipes/saved → recetas guardadas (favoritas)
async function listSaved(req, res) {
  const rows = await prisma.savedRecipe.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
  const fridge = await listFridge(req.user.id);
  const keys = new Set(rows.map((r) => r.recipeKey));

  const list = [];
  for (const row of rows) {
    if (row.source === 'AI' && row.data) {
      list.push(recipes.withMatch(row.data, fridge, keys));
      continue;
    }
    // FatSecret: solo guardamos el recipe_id; el resto se vuelve a pedir (caché de 24 h).
    try {
      const detail = await recipes.getFatSecretDetail(row.externalId);
      list.push(detail
        ? recipes.withMatch(detail, fridge, keys)
        : { key: row.recipeKey, source: 'FATSECRET', externalId: row.externalId, unavailable: true, saved: true });
    } catch {
      list.push({ key: row.recipeKey, source: 'FATSECRET', externalId: row.externalId, unavailable: true, saved: true });
    }
  }
  res.json({ recipes: list });
}

// POST /api/recipes/saved { key }
async function saveRecipe(req, res) {
  const userId = req.user.id;
  const { key } = req.body;
  const count = await prisma.savedRecipe.count({ where: { userId } });
  const exists = await prisma.savedRecipe.findUnique({ where: { userId_recipeKey: { userId, recipeKey: key } } });
  if (exists) return res.json({ saved: true });
  if (count >= MAX_SAVED) {
    return res.status(409).json({ error: `Podés guardar hasta ${MAX_SAVED} recetas. Quitá alguna para guardar otra.` });
  }

  if (key.startsWith('fs-')) {
    // De FatSecret solo se guarda el recipe_id (sus condiciones no permiten guardar el resto).
    await prisma.savedRecipe.create({ data: { userId, recipeKey: key, source: 'FATSECRET', externalId: key.slice(3) } });
  } else {
    const recipe = await recipes.findAiRecipe(userId, key);
    if (!recipe) {
      return res.status(404).json({ error: 'Esta receta ya no está disponible para guardar. Pedí sugerencias de nuevo.' });
    }
    await prisma.savedRecipe.create({ data: { userId, recipeKey: key, source: 'AI', data: recipe } });
  }
  res.status(201).json({ saved: true });
}

// DELETE /api/recipes/saved/:key
async function unsaveRecipe(req, res) {
  await prisma.savedRecipe.deleteMany({ where: { userId: req.user.id, recipeKey: req.params.key } });
  res.status(204).end();
}

// POST /api/recipes/log { key, portions } → "Registrar como comida de hoy"
// Los valores salen de la receta guardada en el servidor, no del teléfono.
async function logRecipe(req, res) {
  const user = req.user;
  const portions = Number(req.body.portions);
  const recipe = await recipes.findRecipe(user.id, req.body.key);
  if (!recipe) {
    return res.status(404).json({ error: 'Esta receta ya no está disponible. Guardala o pedí sugerencias de nuevo.' });
  }
  const per = recipe.perServing || {};
  if (per.calories == null) {
    return res.status(422).json({ error: 'Esta receta no tiene información nutricional para registrarla.' });
  }

  const round1 = (n) => Math.round((Number(n) || 0) * portions * 10) / 10;
  const totals = {
    totalCalories: Math.round((Number(per.calories) || 0) * portions),
    totalProteinG: round1(per.proteinG),
    totalCarbsG: round1(per.carbsG),
    totalFatG: round1(per.fatG),
  };
  const portionLabel = `${String(portions).replace('.', ',')} ${portions === 1 ? 'porción' : 'porciones'}`;
  const name = recipe.name.slice(0, 120);

  const feedback = await generateCoachFeedback(
    { ...totals, dishName: name, ingredients: [{ name: `${name} (${portionLabel})`, grams: 0 }] },
    user,
    await recipes.todayIntake(user.id),
  );

  const meal = await prisma.meal.create({
    data: {
      userId: user.id,
      name,
      imageUrl: '', // sin foto (las imágenes de FatSecret no se pueden guardar más de 24 h)
      source: 'RECIPE',
      status: 'ANALYZED',
      ...totals,
      aiRawResponse: { recipeKey: recipe.key, recipeSource: recipe.source, portions },
      ingredients: {
        create: [{
          name: `${name} (${portionLabel})`.slice(0, 120),
          grams: recipe.gramsPerPortion ? Math.round(recipe.gramsPerPortion * portions) : 0,
          calories: totals.totalCalories,
          proteinG: totals.totalProteinG,
          carbsG: totals.totalCarbsG,
          fatG: totals.totalFatG,
          source: 'MANUAL_ADDED',
          fatSecretFoodId: null,
        }],
      },
      coachFeedback: {
        create: {
          summary: String(feedback.summary || '').slice(0, 2000),
          tips: Array.isArray(feedback.tips) ? feedback.tips.slice(0, 10) : [],
          alignment: ['ON_TRACK', 'NEEDS_ADJUSTMENT', 'OFF_TRACK'].includes(feedback.alignment) ? feedback.alignment : 'ON_TRACK',
        },
      },
    },
    include: { ingredients: true, coachFeedback: true },
  });

  logger.info(`Receta ${recipe.key} registrada como comida ${meal.id} (user ${user.id})`);
  res.status(201).json({ meal, coachMocked: Boolean(feedback.mocked) });
}

module.exports = { getUsage, suggest, getRecipe, listSaved, saveRecipe, unsaveRecipe, logRecipe, DAILY_LIMIT };

const crypto = require('crypto');
const prisma = require('../config/prisma');
const fatSecret = require('./fatsecret.service');
const { translateFatSecretRecipes } = require('./recipeAi.service');
const { normalizeFood } = require('../utils/foodName');

// ------------------------------------------------------------------
// Recetas inteligentes: armado de recetas, cruce con la
// heladera ("tengo / falta") y caché de 24 h de FatSecret.
// ------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
// Condiciones de FatSecret: sus datos se pueden tener como máximo 24 h.
const FATSECRET_TTL_MS = DAY_MS;

// Básicos de despensa: nunca cuentan como faltantes (además de lo que marque la IA).
const PANTRY_WORDS = new Set([
  'sal', 'pimienta', 'aceite', 'agua', 'azucar', 'vinagre', 'oregano', 'comino', 'pimenton', 'aji molido',
  'nuez moscada', 'canela', 'laurel', 'provenzal', 'especia', 'condimento', 'caldo en polvo', 'rocio vegetal',
]);
/** "Huevos" → "huevo", "Pechuga de Pollo" → "pechuga pollo" (ver utils/foodName.js). */
const normalize = normalizeFood;

const words = (text) => normalize(text).split(' ').filter(Boolean);

/**
 * El ingrediente está en la heladera si todas sus palabras aparecen en algún
 * alimento de la heladera: "pollo" ↔ "Pechuga de pollo", "huevo" ↔ "Huevos".
 */
function inFridge(ingredientName, fridgeWordSets) {
  const ing = words(ingredientName);
  if (!ing.length) return false;
  return fridgeWordSets.some((set) => ing.every((w) => set.has(w)));
}

function isPantry(ingredient) {
  if (ingredient.pantry === true) return true;
  const n = normalize(ingredient.name);
  return PANTRY_WORDS.has(n) || [...PANTRY_WORDS].some((p) => n.startsWith(`${p} `));
}

const fridgeSets = (fridge) => fridge.map((f) => new Set(words(f.name)));

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n * 10) / 10, max) : null;
};

function cleanIngredient(i) {
  return {
    text: str(i.text || i.name, 160),
    name: str(i.name || i.text, 60).toLowerCase(),
    quantity: str(i.quantity, 30),
    pantry: i.pantry === true,
  };
}

function cleanMacros(m = {}) {
  return {
    calories: num(m.calories, 5000),
    proteinG: num(m.proteinG, 500),
    carbsG: num(m.carbsG, 1000),
    fatG: num(m.fatG, 500),
  };
}

/** Receta de IA → formato común. */
function fromAi(r) {
  return {
    key: `ai-${crypto.randomUUID()}`,
    source: 'AI',
    externalId: null,
    name: str(r.name, 120),
    description: str(r.description, 300),
    imageUrl: null,
    url: null,
    prepMinutes: num(r.prepMinutes, 1440),
    cookMinutes: null,
    servings: Math.max(1, Math.round(Number(r.servings) || 1)),
    perServing: cleanMacros(r.perServing),
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 40).map(cleanIngredient).filter((i) => i.name),
    steps: (Array.isArray(r.steps) ? r.steps : []).slice(0, 30).map((s) => str(s, 600)).filter(Boolean),
    detailed: true,
  };
}

/** Receta de FatSecret + traducción → formato común. */
function fromFatSecret(original, translation, detailed) {
  const t = translation || {};
  return {
    key: `fs-${original.id}`,
    source: 'FATSECRET',
    externalId: original.id,
    name: str(t.name || original.name, 120),
    description: str(t.description || original.description, 300),
    imageUrl: original.imageUrl || null,
    url: original.url || null,
    prepMinutes: original.prepMinutes ?? null,
    cookMinutes: original.cookMinutes ?? null,
    servings: original.servings || null,
    gramsPerPortion: original.gramsPerPortion ?? null,
    perServing: cleanMacros(original.perServing),
    ingredients: (Array.isArray(t.ingredients) ? t.ingredients : []).slice(0, 40).map(cleanIngredient).filter((i) => i.name),
    steps: detailed ? (Array.isArray(t.steps) ? t.steps : []).slice(0, 30).map((s) => str(s, 600)).filter(Boolean) : [],
    detailed,
  };
}

/** Agrega "tengo / falta" según la heladera ACTUAL y si está guardada. */
function withMatch(recipe, fridge, savedKeys = new Set()) {
  const sets = fridgeSets(fridge);
  const ingredients = recipe.ingredients.map((i) => {
    const pantry = isPantry(i);
    return { ...i, pantry, have: pantry || inFridge(i.name, sets) };
  });
  const counted = ingredients.filter((i) => !i.pantry);
  const haveCount = counted.filter((i) => i.have).length;
  return {
    ...recipe,
    ingredients,
    haveCount,
    totalCount: counted.length,
    missingCount: counted.length - haveCount,
    saved: savedKeys.has(recipe.key),
  };
}

/** Calorías y macros que ya comió hoy (mismo criterio de "hoy" que el límite del plan). */
async function todayIntake(userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const agg = await prisma.meal.aggregate({
    where: { userId, loggedAt: { gte: start } },
    _sum: { totalCalories: true, totalProteinG: true, totalCarbsG: true, totalFatG: true },
    _count: { _all: true },
  });
  return {
    mealsCount: agg._count._all,
    totalCalories: Number(agg._sum.totalCalories) || 0,
    totalProteinG: Number(agg._sum.totalProteinG) || 0,
    totalCarbsG: Number(agg._sum.totalCarbsG) || 0,
    totalFatG: Number(agg._sum.totalFatG) || 0,
  };
}

/** Borra lo que pasó las 24 h (sugerencias y traducciones con datos de FatSecret). */
async function purgeExpired() {
  const limit = new Date(Date.now() - FATSECRET_TTL_MS);
  await Promise.all([
    prisma.recipeSuggestion.deleteMany({ where: { createdAt: { lt: limit } } }),
    prisma.fatSecretRecipeCache.deleteMany({ where: { createdAt: { lt: limit } } }),
  ]);
}

/**
 * Detalle traducido de una receta de FatSecret.
 * Devuelve null si FatSecret no la encuentra.
 */
async function getFatSecretDetail(recipeId) {
  const cached = await prisma.fatSecretRecipeCache.findUnique({ where: { recipeId } });
  if (cached && Date.now() - cached.createdAt.getTime() < FATSECRET_TTL_MS) return cached.data;

  const original = await fatSecret.getRecipe(recipeId);
  if (!original) return null;
  const translations = await translateFatSecretRecipes([original], true);
  const recipe = fromFatSecret(original, translations.get(original.id), true);

  await prisma.fatSecretRecipeCache.upsert({
    where: { recipeId },
    create: { recipeId, data: recipe },
    update: { data: recipe, createdAt: new Date() },
  });
  return recipe;
}

/** Busca una receta de IA del usuario: primero en sus guardadas, después en sus sugerencias de las últimas 24 h. */
async function findAiRecipe(userId, key) {
  const saved = await prisma.savedRecipe.findUnique({ where: { userId_recipeKey: { userId, recipeKey: key } } });
  if (saved?.data) return saved.data;
  const rows = await prisma.recipeSuggestion.findMany({
    where: { userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    orderBy: { createdAt: 'desc' },
    select: { recipes: true },
  });
  for (const row of rows) {
    const found = (Array.isArray(row.recipes) ? row.recipes : []).find((r) => r.key === key);
    if (found) return found;
  }
  return null;
}

/** Cualquier receta por su key ("ai-..." o "fs-..."). */
async function findRecipe(userId, key) {
  if (key.startsWith('fs-')) return getFatSecretDetail(key.slice(3));
  if (key.startsWith('ai-')) return findAiRecipe(userId, key);
  return null;
}

module.exports = {
  normalize,
  fromAi,
  fromFatSecret,
  withMatch,
  todayIntake,
  purgeExpired,
  getFatSecretDetail,
  findRecipe,
  findAiRecipe,
  DAY_MS,
};

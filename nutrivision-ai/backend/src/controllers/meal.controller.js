const prisma = require('../config/prisma');
const geminiService = require('../services/gemini.service');
const fatSecretService = require('../services/fatsecret.service');
const { sumIngredients } = require('../services/nutrition.service');
const { FREE_DAILY_SCAN_LIMIT } = require('./plan.controller');
const logger = require('../utils/logger');

// POST /api/meals/analyze  (multipart/form-data, campo "image")
// Solo ANALIZA — no escribe nada en la base todavía. El plato recién
// se guarda cuando el usuario confirma con un nombre (ver createMeal).
async function analyzeMeal(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Falta el archivo de imagen ("image").' });
  }

  // Chequeamos el límite ANTES de gastar una llamada a la IA: no tiene
  // sentido analizar algo que después no se va a poder guardar.
  const limitError = await checkFreePlanLimit(req.user);
  if (limitError) return res.status(403).json(limitError);

  const analysis = await geminiService.analyzeMealImage(req.file.buffer, req.file.mimetype);

  if (!analysis.ingredients.length) {
    return res.status(422).json({
      error: 'No pudimos identificar ingredientes en la imagen. Probá con otra foto, con mejor luz y encuadre.',
    });
  }

  // Enriquecimiento opcional contra FatSecret (no bloquea el flujo si falla).
  await Promise.allSettled(
    analysis.ingredients.map(async (ing) => {
      const match = await fatSecretService.searchFood(ing.name);
      if (match) ing.fatSecretFoodId = match.fatSecretFoodId;
    }),
  );

  const totals = sumIngredients(analysis.ingredients);
  const feedback = await geminiService.generateCoachFeedback(
    {
      totalCalories: totals.totalCalories,
      totalProteinG: totals.totalProteinG,
      totalCarbsG: totals.totalCarbsG,
      totalFatG: totals.totalFatG,
    },
    req.user,
  );

  res.status(200).json({
    ingredients: analysis.ingredients,
    totals,
    coachFeedback: {
      summary: feedback.summary,
      tips: feedback.tips || [],
      alignment: feedback.alignment || 'ON_TRACK',
    },
    mocked: analysis.mocked,
  });
}

// POST /api/meals  (multipart/form-data: "image" + "name" + "ingredients" + "coachFeedback")
// Acá sí se persiste de verdad.
async function createMeal(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Falta el archivo de imagen ("image").' });
  }

  // Se vuelve a chequear el límite acá — nunca confiamos en que el
  // cliente haya respetado el bloqueo del paso anterior.
  const limitError = await checkFreePlanLimit(req.user);
  if (limitError) return res.status(403).json(limitError);

  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
  if (!name) {
    return res.status(422).json({ error: 'El plato necesita un nombre antes de guardarse.' });
  }

  let ingredients;
  let coachFeedback;
  try {
    ingredients = JSON.parse(req.body.ingredients);
    coachFeedback = JSON.parse(req.body.coachFeedback);
  } catch {
    return res.status(400).json({ error: 'Datos de ingredientes o devolución del coach inválidos.' });
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(422).json({ error: 'El plato necesita al menos un ingrediente.' });
  }

  const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  // Recalculamos los totales server-side a partir de los ingredientes
  // recibidos — nunca confiamos en totales calculados por el cliente.
  const totals = sumIngredients(ingredients);

  const meal = await prisma.meal.create({
    data: {
      userId: req.user.id,
      name,
      imageUrl,
      source: 'WEB_UPLOAD',
      status: 'ANALYZED',
      ...totals,
      ingredients: {
        create: ingredients.map((ing) => ({
          name: String(ing.name).slice(0, 120),
          grams: Number(ing.grams) || 0,
          calories: Number(ing.calories) || 0,
          proteinG: Number(ing.proteinG) || 0,
          carbsG: Number(ing.carbsG) || 0,
          fatG: Number(ing.fatG) || 0,
          source: ing.source === 'MANUAL_ADDED' || ing.source === 'MANUAL_EDITED' ? ing.source : 'AI_DETECTED',
          fatSecretFoodId: ing.fatSecretFoodId || null,
        })),
      },
      coachFeedback: {
        create: {
          summary: String(coachFeedback?.summary || '').slice(0, 2000),
          tips: Array.isArray(coachFeedback?.tips) ? coachFeedback.tips.slice(0, 10) : [],
          alignment: ['ON_TRACK', 'NEEDS_ADJUSTMENT', 'OFF_TRACK'].includes(coachFeedback?.alignment)
            ? coachFeedback.alignment
            : 'ON_TRACK',
        },
      },
    },
    include: { ingredients: true, coachFeedback: true },
  });

  logger.info(`Meal ${meal.id} guardado para user ${req.user.id}`);

  res.status(201).json({ meal });
}

// Devuelve un objeto de error si el usuario del plan Gratuito ya llegó
// a su límite diario, o null si puede seguir escaneando.
async function checkFreePlanLimit(user) {
  if (user.plan === 'PREMIUM') return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const scansToday = await prisma.meal.count({
    where: { userId: user.id, loggedAt: { gte: startOfDay } },
  });

  if (scansToday >= FREE_DAILY_SCAN_LIMIT) {
    return {
      error: `Llegaste al límite de ${FREE_DAILY_SCAN_LIMIT} escaneos diarios del plan Gratuito. Pasate a Premium para escanear sin límite.`,
      limitReached: true,
    };
  }
  return null;
}

// GET /api/meals/:id
async function getMeal(req, res) {
  const meal = await prisma.meal.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { ingredients: true, coachFeedback: true },
  });

  if (!meal) return res.status(404).json({ error: 'Plato no encontrado.' });
  res.json({ meal });
}

// DELETE /api/meals/:id
async function deleteMeal(req, res) {
  const meal = await prisma.meal.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!meal) return res.status(404).json({ error: 'Plato no encontrado.' });

  await prisma.meal.delete({ where: { id: meal.id } });
  res.status(204).send();
}

module.exports = { analyzeMeal, createMeal, getMeal, deleteMeal };

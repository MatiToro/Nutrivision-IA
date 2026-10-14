const prisma = require('../config/prisma');
const geminiService = require('../services/gemini.service');
const fatSecretService = require('../services/fatsecret.service');
const { sumIngredients } = require('../services/nutrition.service');
const { FREE_DAILY_SCAN_LIMIT } = require('./plan.controller');
const { isPremiumUser } = require('../utils/premium');
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

  if (!analysis.isFood) {
    return res.status(422).json({
      error: 'La imagen no parece contener comida. Subí una foto de tu plato.',
    });
  }

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
      dishName: analysis.dishName,
      ingredients: analysis.ingredients,
    },
    req.user,
    await getTodayIntake(req.user.id),
  );

  res.status(200).json({
    dishName: analysis.dishName,
    ingredients: analysis.ingredients,
    totals,
    coachFeedback: {
      summary: feedback.summary,
      tips: feedback.tips || [],
      alignment: feedback.alignment || 'ON_TRACK',
    },
    mocked: analysis.mocked,
    coachMocked: Boolean(feedback.mocked),
  });
}

// POST /api/meals  (multipart/form-data: "image" + "name" + "ingredients" + "coachFeedback" [+ "source" desde mobile])
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

  // Origen de la foto: la app mobile manda si vino de la cámara o de la galería.
  // Cualquier otro valor (o ninguno, como en la Web) queda como WEB_UPLOAD.
  const source = ['MOBILE_CAMERA', 'MOBILE_GALLERY'].includes(req.body.source) ? req.body.source : 'WEB_UPLOAD';

  const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  // Recalculamos los totales a partir de los ingredientes recibidos.
  const totals = sumIngredients(ingredients);

  const meal = await prisma.meal.create({
    data: {
      userId: req.user.id,
      name,
      imageUrl,
      source,
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

// POST /api/meals/ingredient-nutrition  { name, grams }
// Recalcula los macros de UN ingrediente cuando el usuario le corrige el
// nombre en el editor (ej. la IA dijo "milanesa de carne" y era de pollo).
// No escribe nada en la base: el resultado vuelve al editor en memoria.
async function ingredientNutrition(req, res) {
  const name = req.body.name.trim();
  const grams = Number(req.body.grams);
  // Con 0 g no hay nada que calcular: pedimos la referencia a 100 g y el
  // frontend la escala a la cantidad que ponga el usuario.
  const lookupGrams = grams > 0 ? grams : 100;

  const result = await geminiService.estimateIngredientNutrition(name, lookupGrams);
  if (!result.recognized) {
    return res.status(422).json({
      error: `No reconocimos "${name}" como un alimento. Revisá el nombre.`,
    });
  }

  let fatSecretFoodId = null;
  const match = await fatSecretService.searchFood(name);
  if (match) fatSecretFoodId = match.fatSecretFoodId;

  res.json({ ingredient: { name, ...result, fatSecretFoodId } });
}

// POST /api/meals/coach  { dishName, ingredients[] }
// Vuelve a generar la devolución del Coach después de que el usuario
// editó los ingredientes, para que el consejo corresponda al plato real.
async function regenerateCoach(req, res) {
  const ingredients = req.body.ingredients.map((ing) => ({
    name: String(ing.name).slice(0, 120),
    grams: Number(ing.grams) || 0,
    calories: Number(ing.calories) || 0,
    proteinG: Number(ing.proteinG) || 0,
    carbsG: Number(ing.carbsG) || 0,
    fatG: Number(ing.fatG) || 0,
  }));
  // Totales recalculados server-side, igual que al guardar.
  const totals = sumIngredients(ingredients);
  const dishName = typeof req.body.dishName === 'string' ? req.body.dishName.trim().slice(0, 120) : '';

  const feedback = await geminiService.generateCoachFeedback(
    { ...totals, dishName, ingredients },
    req.user,
    await getTodayIntake(req.user.id),
  );

  res.json({
    coachFeedback: {
      summary: feedback.summary,
      tips: feedback.tips || [],
      alignment: feedback.alignment || 'ON_TRACK',
    },
    coachMocked: Boolean(feedback.mocked),
  });
}

// Suma lo que el usuario ya guardó hoy (antes del plato que se está
// evaluando). Usa el mismo criterio de "hoy" que el límite del plan.
async function getTodayIntake(userId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const agg = await prisma.meal.aggregate({
    where: { userId, loggedAt: { gte: startOfDay } },
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

// Devuelve un objeto de error si el usuario del plan Gratuito ya llegó
// a su límite diario, o null si puede seguir escaneando.
async function checkFreePlanLimit(user) {
  if (isPremiumUser(user)) return null; // plan pago o código de nutricionista vigente

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Las comidas registradas desde una receta no cuentan como escaneo.
  const scansToday = await prisma.meal.count({
    where: { userId: user.id, loggedAt: { gte: startOfDay }, source: { not: 'RECIPE' } },
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

module.exports = {
  analyzeMeal, createMeal, getMeal, deleteMeal, ingredientNutrition, regenerateCoach,
};

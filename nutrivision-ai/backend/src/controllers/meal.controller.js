const prisma = require('../config/prisma');
const geminiService = require('../services/gemini.service');
const { verifyIngredients } = require('../services/foodVerify.service');
const { sumIngredients } = require('../services/nutrition.service');
const { FREE_DAILY_SCAN_LIMIT, countScansToday } = require('./plan.controller');
const { isPremiumUser } = require('../utils/premium');
const logger = require('../utils/logger');

// POST /api/meals/analyze[?deferCoach=1]  (multipart/form-data, campo "image")
// Solo ANALIZA — no guarda la comida todavía. El plato recién se guarda
// cuando el usuario confirma con un nombre (ver createMeal).
// Sí registra el escaneo (ScanLog), que es lo que cuenta el límite diario.
// Con ?deferCoach=1 (app y web nuevas) devuelve el resultado SIN el Coach, para
// mostrarlo enseguida; el Coach se pide aparte a POST /meals/coach.
// Sin el parámetro (versiones viejas de la app) responde todo junto, como antes.
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

  // Verificación contra FatSecret: si encuentra el alimento genérico y los
  // valores son razonables, los macros pasan a ser los de FatSecret. Si no
  // (o si FatSecret falla), quedan los estimados por Gemini.
  analysis.ingredients = await verifyIngredients(analysis.ingredients);

  // La foto se analizó bien: cuenta como escaneo del día (también si después
  // no la guarda, porque la IA ya se usó). Se registra para todos los planes.
  if (!analysis.mocked) {
    await prisma.scanLog.create({ data: { userId: req.user.id } });
  }

  const totals = sumIngredients(analysis.ingredients);
  const result = {
    dishName: analysis.dishName,
    ingredients: analysis.ingredients,
    totals,
    mocked: analysis.mocked,
  };

  if (req.query.deferCoach === '1') {
    return res.status(200).json({ ...result, coachPending: true });
  }

  const coach = await coachForPlan(
    { ...totals, dishName: analysis.dishName, ingredients: analysis.ingredients },
    req.user,
  );
  res.status(200).json({ ...result, ...coach });
}

// Coach según el plan: COMPLETO para Pro (o Premium por código) y BREVE para el
// plan Gratuito. Si la IA no responde, el servicio devuelve la versión con reglas.
async function coachForPlan(meal, user) {
  const premium = isPremiumUser(user);
  const feedback = await geminiService.generateCoachFeedback(
    meal,
    user,
    await getTodayIntake(user.id),
    { brief: !premium },
  );
  return {
    coachFeedback: {
      summary: feedback.summary,
      tips: feedback.tips || [],
      alignment: feedback.alignment || 'ON_TRACK',
    },
    coachMocked: Boolean(feedback.mocked),
    // BRIEF = Coach breve del plan Gratuito (la app muestra la invitación a Pro).
    coachLevel: premium ? 'FULL' : 'BRIEF',
  };
}

// POST /api/meals  (multipart/form-data: "image" + "name" + "ingredients" + "coachFeedback" [+ "source" desde mobile])
// Acá sí se persiste de verdad.
async function createMeal(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Falta el archivo de imagen ("image").' });
  }

  // El límite diario se controla al ANALIZAR la foto (ahí se usa la IA y se
  // registra el escaneo). Guardar no vuelve a descontar: si no, la tercera foto
  // analizada del día no se podría guardar.

  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
  if (!name) {
    return res.status(422).json({ error: 'El plato necesita un nombre antes de guardarse.' });
  }

  let ingredients;
  let coachFeedback = null;
  try {
    ingredients = JSON.parse(req.body.ingredients);
    if (req.body.coachFeedback) coachFeedback = JSON.parse(req.body.coachFeedback);
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

  // Si se guarda sin devolución del Coach (por ejemplo, la IA no respondió),
  // se usa la versión calculada con reglas: no se vuelve a llamar a la IA.
  if (!coachFeedback || !String(coachFeedback.summary || '').trim()) {
    coachFeedback = geminiService.buildBasicCoachFeedback(
      { ...totals, name },
      req.user,
      await getTodayIntake(req.user.id),
    );
  }

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

  // Mismo control que en el escaneo: FatSecret valida los macros si puede.
  const [checked] = await verifyIngredients([{ name, ...result }]);

  res.json({ ingredient: { ...checked, recognized: result.recognized } });
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

  res.json(await coachForPlan({ ...totals, dishName, ingredients }, req.user));
}

// POST /api/meals/:id/repeat  { portions }
// "Registrar de nuevo": copia una comida propia al día de hoy (con la hora
// actual), escalando las porciones. No usa la IA de visión ni cuenta como
// escaneo; sí genera la devolución del Coach según el plan, con el día de hoy.
async function repeatMeal(req, res) {
  const original = await prisma.meal.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { ingredients: true },
  });
  if (!original) return res.status(404).json({ error: 'Plato no encontrado.' });

  const factor = Number(req.body.portions) || 1;
  const round1 = (n) => Math.round((Number(n) || 0) * factor * 10) / 10;

  const ingredients = original.ingredients.map((ing) => ({
    name: ing.name,
    grams: round1(ing.grams),
    calories: round1(ing.calories),
    proteinG: round1(ing.proteinG),
    carbsG: round1(ing.carbsG),
    fatG: round1(ing.fatG),
    source: ing.source,
    fatSecretFoodId: ing.fatSecretFoodId,
  }));

  // Una comida sin ingredientes (no debería pasar) se escala por sus totales.
  const totals = ingredients.length
    ? sumIngredients(ingredients)
    : {
      totalCalories: round1(original.totalCalories),
      totalProteinG: round1(original.totalProteinG),
      totalCarbsG: round1(original.totalCarbsG),
      totalFatG: round1(original.totalFatG),
    };

  const name = original.name || 'Comida repetida';
  const coach = await coachForPlan({ ...totals, dishName: name, ingredients }, req.user);

  const meal = await prisma.meal.create({
    data: {
      userId: req.user.id,
      name,
      imageUrl: original.imageUrl,
      source: 'REPEAT',
      status: 'ANALYZED',
      ...totals,
      ingredients: { create: ingredients },
      coachFeedback: { create: coach.coachFeedback },
    },
    include: { ingredients: true, coachFeedback: true },
  });

  logger.info(`Meal ${meal.id} repetido de ${original.id} (x${factor}) para user ${req.user.id}`);
  res.status(201).json({ meal, coachLevel: coach.coachLevel, coachMocked: coach.coachMocked });
}

// GET /api/meals/recent
// Comidas recientes para "Registrar de nuevo" desde el escáner: liviano (sin
// fotos ni ingredientes) y sin nombres repetidos.
async function recentMeals(req, res) {
  const rows = await prisma.meal.findMany({
    where: { userId: req.user.id },
    orderBy: { loggedAt: 'desc' },
    take: 40,
    select: { id: true, name: true, totalCalories: true, loggedAt: true },
  });

  const seen = new Set();
  const meals = [];
  for (const m of rows) {
    const key = (m.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    meals.push(m);
    if (meals.length >= 8) break;
  }
  res.json({ meals });
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

  // Cuentan las fotos analizadas hoy (ScanLog); repetir una comida o
  // registrarla desde una receta no gasta escaneos.
  const scansToday = await countScansToday(user.id);

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
  // Para mostrar (o no) la invitación al Coach completo de Pro en el detalle.
  res.json({ meal, viewerIsPremium: isPremiumUser(req.user) });
}

// DELETE /api/meals/:id
async function deleteMeal(req, res) {
  const meal = await prisma.meal.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!meal) return res.status(404).json({ error: 'Plato no encontrado.' });

  await prisma.meal.delete({ where: { id: meal.id } });
  res.status(204).send();
}

module.exports = {
  analyzeMeal, createMeal, getMeal, deleteMeal, ingredientNutrition, regenerateCoach, repeatMeal, recentMeals,
};

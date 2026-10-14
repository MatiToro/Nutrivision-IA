const env = require('../config/env');
const logger = require('../utils/logger');

// ------------------------------------------------------------------
// Integración REAL con la Gemini API (Google AI Studio).
//
// Se llama a la API REST directamente con fetch (Node >= 18).
// ------------------------------------------------------------------

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 45_000;

// Orden de modelos a probar. El primero es el configurado en el .env
// (GEMINI_MODEL). Si Google retira un modelo,
// caemos al alias "latest" y, como último recurso, le preguntamos a la API
// qué modelos Flash tiene disponibles esta API key.
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];

let resolvedModel = null; // se cachea el primer modelo que responde bien

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFood: { type: 'BOOLEAN' },
    dishName: { type: 'STRING' },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          grams: { type: 'NUMBER' },
          calories: { type: 'NUMBER' },
          proteinG: { type: 'NUMBER' },
          carbsG: { type: 'NUMBER' },
          fatG: { type: 'NUMBER' },
        },
        required: ['name', 'grams', 'calories', 'proteinG', 'carbsG', 'fatG'],
      },
    },
  },
  required: ['isFood', 'dishName', 'ingredients'],
};

const COACH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    tips: { type: 'ARRAY', items: { type: 'STRING' } },
    alignment: { type: 'STRING', enum: ['ON_TRACK', 'NEEDS_ADJUSTMENT', 'OFF_TRACK'] },
  },
  required: ['summary', 'tips', 'alignment'],
};

const VISION_PROMPT = `Sos un nutricionista experto en análisis de platos por foto.
Analizá la imagen y respondé en español rioplatense.

Instrucciones:
1. Si la imagen NO muestra comida o bebida, devolvé isFood=false, dishName="" e ingredients=[].
2. dishName: un nombre corto y natural para el plato (ej. "Milanesa con puré", "Ensalada César").
3. Identificá cada ingrediente o componente visible por separado (incluí aceites, salsas o
   aderezos solo si se ven o si la preparación claramente los lleva, ej. fritura).
4. Estimá el peso en gramos de cada componente TAL COMO ESTÁ SERVIDO (cocido), usando como
   referencia el tamaño del plato, cubiertos u otros objetos de la foto.
5. Calculá calorías (kcal), proteínas, carbohidratos y grasas (en gramos) de cada componente
   para ESA cantidad, usando valores de tablas nutricionales estándar (USDA / tablas argentinas).
6. Los números deben ser coherentes: calorías ≈ 4*proteína + 4*carbohidratos + 9*grasa.
7. Usá nombres de ingredientes simples en español (ej. "Arroz blanco cocido", "Pechuga de pollo grillada").`;

// ------------------------------------------------------------------
// Llamada HTTP a Gemini
// ------------------------------------------------------------------

class GeminiHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.httpStatus = status;
  }
}

async function callGenerateContent(model, body) {
  const response = await fetch(`${API_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // La key viaja en header (no en la URL) para que no quede en logs.
      'x-goog-api-key': env.gemini.apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new GeminiHttpError(response.status, data?.error?.message || `HTTP ${response.status}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    const reason = data.promptFeedback?.blockReason || 'sin candidatos';
    throw new GeminiHttpError(422, `Gemini no devolvió respuesta (${reason}).`);
  }

  const text = (candidate.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) {
    throw new GeminiHttpError(422, `Respuesta vacía de Gemini (finishReason: ${candidate.finishReason}).`);
  }

  return parseJsonLoose(text);
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('La respuesta de Gemini no es un JSON válido.');
  }
}

// Le pide a la API la lista de modelos disponibles para esta key y elige el Flash estable más nuevo.
async function discoverFlashModel() {
  try {
    const response = await fetch(`${API_BASE}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': env.gemini.apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const candidates = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((name) => /^gemini-\d+(\.\d+)?-flash$/.test(name))
      .sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]));
    return candidates[0] || null;
  } catch {
    return null;
  }
}

// Ejecuta la request probando modelos en orden hasta que uno funcione.
// Solo se pasa al siguiente modelo si el error es "modelo no existe" (404),
// "sin cuota" (429) o "sobrecargado" (500/503). Errores de key inválida
// (400/401/403) cortan enseguida porque ningún modelo los va a resolver.
async function generateWithFallback(body) {
  const tried = new Set();
  const queue = [resolvedModel, env.gemini.model, ...FALLBACK_MODELS].filter(Boolean);
  let discovered = false;
  let lastError;

  while (queue.length) {
    const model = queue.shift();
    if (tried.has(model)) continue;
    tried.add(model);

    try {
      const result = await callGenerateContent(model, body);
      if (resolvedModel !== model) {
        logger.info(`Gemini: usando el modelo "${model}".`);
        resolvedModel = model;
      }
      return result;
    } catch (err) {
      lastError = err;
      const status = err.httpStatus;
      const retryable = status === 404 || status === 429 || status === 500 || status === 503
        || err.name === 'TimeoutError';
      logger.warn(`Gemini (${model}) falló [${status || err.name}]: ${err.message}`);
      if (!retryable) break;
      if (resolvedModel === model) resolvedModel = null;

      if (!queue.length && !discovered) {
        discovered = true;
        const found = await discoverFlashModel();
        if (found) queue.push(found);
      }
    }
  }
  throw lastError;
}

// ------------------------------------------------------------------
// Preprocesamiento de la imagen: achicarla antes de mandarla reduce
// latencia y consumo de tokens sin perder precisión para reconocer comida.
// Si sharp no está disponible (o falla), se manda la imagen original.
// ------------------------------------------------------------------
async function prepareImage(buffer, mimeType) {
  try {
    // eslint-disable-next-line global-require
    const sharp = require('sharp');
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { data: out.toString('base64'), mimeType: 'image/jpeg' };
  } catch (err) {
    logger.debug(`No se pudo redimensionar la imagen (${err.message}); se envía la original.`);
    return { data: buffer.toString('base64'), mimeType };
  }
}

// Gemini puede devolver números como string, negativos o NaN: los
// normalizamos para que nunca lleguen valores basura al frontend/base.
function num(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, max) * 10) / 10;
}

function sanitizeIngredients(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((ing) => ing && typeof ing.name === 'string' && ing.name.trim())
    .slice(0, 20)
    .map((ing) => ({
      name: ing.name.trim().slice(0, 120),
      grams: num(ing.grams, 3000),
      calories: Math.round(num(ing.calories, 5000)),
      proteinG: num(ing.proteinG, 500),
      carbsG: num(ing.carbsG, 1000),
      fatG: num(ing.fatG, 500),
    }))
    .filter((ing) => ing.grams > 0);
}

// ------------------------------------------------------------------
// API pública del servicio
// ------------------------------------------------------------------

/**
 * Analiza una imagen de un plato de comida.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @returns {Promise<{ingredients: Array, dishName: string, isFood: boolean, raw: object, mocked: boolean}>}
 */
async function analyzeMealImage(imageBuffer, mimeType) {
  if (!env.gemini.isConfigured) {
    logger.warn('GEMINI_API_KEY no configurada: devolviendo análisis SIMULADO.');
    return buildMockAnalysis();
  }

  const image = await prepareImage(imageBuffer, mimeType);

  let parsed;
  try {
    parsed = await generateWithFallback({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.data } },
          { text: VISION_PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.2, // estimaciones estables, no creatividad
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA,
      },
    });
  } catch (err) {
    logger.error(`Error llamando a Gemini Vision: ${err.message}`);
    const friendly = new Error(friendlyMessage(err));
    friendly.status = err.httpStatus === 429 ? 429 : 502;
    throw friendly;
  }

  const ingredients = parsed.isFood === false ? [] : sanitizeIngredients(parsed.ingredients);

  return {
    ingredients,
    dishName: typeof parsed.dishName === 'string' ? parsed.dishName.trim().slice(0, 120) : '',
    isFood: parsed.isFood !== false,
    raw: { ...parsed, model: resolvedModel },
    mocked: false,
  };
}

function friendlyMessage(err) {
  if (err.httpStatus === 429) {
    return 'Se alcanzó el límite de uso de la IA por ahora. Esperá un minuto y probá de nuevo.';
  }
  if (err.httpStatus === 400 || err.httpStatus === 401 || err.httpStatus === 403) {
    return 'El servicio de IA rechazó la solicitud (revisá la GEMINI_API_KEY del backend).';
  }
  if (err.name === 'TimeoutError') {
    return 'La IA tardó demasiado en responder. Probá de nuevo.';
  }
  return 'No pudimos analizar la imagen en este momento. Probá de nuevo.';
}

const GOAL_LABELS = {
  LOSE_WEIGHT: 'bajar de peso',
  MAINTAIN: 'mantener el peso',
  GAIN_MUSCLE: 'ganar masa muscular',
  GAIN_WEIGHT: 'subir de peso',
  MODIFY_DIET: 'comer más sano / mejorar la calidad de su alimentación',
};

// Reglas explícitas por objetivo. Se le pasan al modelo para que el
// criterio de evaluación sea consistente y no dependa de lo que "deduzca".
const GOAL_RULES = {
  LOSE_WEIGHT: `- Prioridad: mantener el déficit calórico del día y la saciedad.
- Valorá positivamente: buena proteína, verduras, fibra, platos con mucho volumen y pocas calorías.
- Marcá como problema: alta densidad calórica con poca proteína, frituras, ultraprocesados, bebidas azucaradas, salsas muy calóricas.
- Si con este plato el total del día supera la meta calórica, alignment no puede ser ON_TRACK; si la supera por más de 15 %, OFF_TRACK.`,
  MAINTAIN: `- Prioridad: que el plato encaje en lo que le queda del día y sea equilibrado (proteína + vegetales + carbohidrato razonable).
- Un plato menos saludable ocasional puede ser ON_TRACK si entra en las calorías restantes y el resto del día viene equilibrado.
- Si con este plato el total del día supera la meta calórica en más de 10 %, NEEDS_ADJUSTMENT; más de 25 %, OFF_TRACK.`,
  GAIN_MUSCLE: `- Prioridad: proteína suficiente en cada comida (idealmente 25-40 g) y energía para entrenar.
- Menos de 20 g de proteína en una comida principal → NEEDS_ADJUSTMENT como mínimo.
- Quedarse corto de calorías en el día también es un problema (sugerí cómo completarlas); pasarse levemente no lo es.
- Preferí fuentes de calidad (carnes magras, huevo, lácteos, legumbres) por sobre ultraprocesados.`,
  GAIN_WEIGHT: `- Prioridad: llegar a la meta calórica diaria (superávit) con alimentos nutritivos.
- Un plato chico o poco calórico es un problema: sugerí cómo sumar calorías de calidad (frutos secos, aceite de oliva, palta, lácteos enteros, más porción).
- La densidad calórica es positiva, pero si viene de ultraprocesados o frituras, mencionalo y proponé alternativas.
- Pasarse de la meta no es un problema salvo que sea por mucho y con comida de baja calidad.`,
  MODIFY_DIET: `- Prioridad: la CALIDAD de la comida, por encima de las calorías.
- Aunque el plato entre en las calorías del día, si es principalmente ultraprocesado, frito, con embutidos, harinas refinadas, mucha azúcar o mucho sodio (ej. hamburguesa de cadena con papas fritas, pizza, facturas, gaseosa), alignment debe ser NEEDS_ADJUSTMENT u OFF_TRACK.
- ON_TRACK solo si predominan alimentos frescos o poco procesados: verduras, frutas, legumbres, cereales integrales, proteínas magras, grasas saludables.
- Los consejos deben proponer reemplazos concretos y realistas (ej. "hamburguesa casera de carne magra en pan integral con ensalada en vez de papas fritas").`,
};

const DEFAULT_RULES = `- Evaluá el equilibrio del plato y si encaja en lo que le queda del día.`;

function r0(n) {
  return Math.round(Number(n) || 0);
}

/**
 * Genera la devolución del Coach IA cruzando el plato con:
 *  - el objetivo principal del usuario (con reglas explícitas por objetivo),
 *  - sus metas diarias,
 *  - lo que YA comió hoy (platos guardados antes de este).
 *
 * @param {object} meal   { dishName, ingredients[], totalCalories, totalProteinG, totalCarbsG, totalFatG }
 * @param {object} user   usuario de Prisma (goal + metas diarias)
 * @param {object} [today] { mealsCount, totalCalories, totalProteinG, totalCarbsG, totalFatG }
 */
async function generateCoachFeedback(meal, user, today = null) {
  if (!env.gemini.isConfigured) {
    return buildMockCoachFeedback(meal, user, today);
  }

  const ingredientList = (meal.ingredients || [])
    .map((i) => `- ${i.name} (${r0(i.grams)} g)`)
    .join('\n') || '- (sin detalle)';

  const eaten = today || { mealsCount: 0, totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 };
  const afterCalories = eaten.totalCalories + meal.totalCalories;
  const afterProtein = eaten.totalProteinG + meal.totalProteinG;
  const hasGoals = Boolean(user.dailyCalorieGoal);

  const dayBlock = hasGoals
    ? `Lo que ya comió HOY antes de este plato (${eaten.mealsCount} comida/s guardada/s): ${r0(eaten.totalCalories)} kcal, ${r0(eaten.totalProteinG)} g proteína, ${r0(eaten.totalCarbsG)} g carbohidratos, ${r0(eaten.totalFatG)} g grasas.
Si suma este plato, el día queda en: ${r0(afterCalories)} de ${r0(user.dailyCalorieGoal)} kcal (${Math.round((afterCalories / user.dailyCalorieGoal) * 100)} %) y ${r0(afterProtein)} de ${r0(user.dailyProteinGoalG)} g de proteína.
${afterCalories <= user.dailyCalorieGoal
    ? `Le quedarían ${r0(user.dailyCalorieGoal - afterCalories)} kcal disponibles para el resto del día.`
    : `Con este plato se pasaría de su meta diaria por ${r0(afterCalories - user.dailyCalorieGoal)} kcal.`}`
    : 'El usuario todavía no tiene metas diarias definidas.';

  const prompt = `Sos un coach nutricional breve y directo, con tono motivador y cercano (no clínico),
en español rioplatense. No des diagnósticos médicos ni juzgues a la persona: evaluás el plato.

PLATO A EVALUAR: ${meal.dishName || 'sin nombre'}
Ingredientes:
${ingredientList}
Totales del plato: ${r0(meal.totalCalories)} kcal, ${r0(meal.totalProteinG)} g proteína, ${r0(meal.totalCarbsG)} g carbohidratos, ${r0(meal.totalFatG)} g grasas.

USUARIO
- Objetivo principal: ${GOAL_LABELS[user.goal] || 'sin definir'}
- Meta diaria: ${user.dailyCalorieGoal || '?'} kcal, ${user.dailyProteinGoalG || '?'} g proteína, ${user.dailyCarbsGoalG || '?'} g carbohidratos, ${user.dailyFatGoalG || '?'} g grasas.

CONTEXTO DEL DÍA
${dayBlock}

REGLAS PARA SU OBJETIVO (seguilas al decidir "alignment" y los consejos):
${GOAL_RULES[user.goal] || DEFAULT_RULES}

Devolvé:
- summary: 1 o 2 frases evaluando el plato respecto del objetivo y de cómo viene el día.
- tips: 2 o 3 consejos cortos y accionables (máx. 20 palabras cada uno). Si aplica, usá los números del día (ej. "te quedan ~600 kcal para la cena").
- alignment: ON_TRACK si encaja bien con el objetivo, NEEDS_ADJUSTMENT si requiere ajustes, OFF_TRACK si va claramente en contra.`;

  try {
    const parsed = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: COACH_SCHEMA,
      },
    });
    return {
      summary: String(parsed.summary || '').slice(0, 2000),
      tips: Array.isArray(parsed.tips) ? parsed.tips.map(String).slice(0, 5) : [],
      alignment: ['ON_TRACK', 'NEEDS_ADJUSTMENT', 'OFF_TRACK'].includes(parsed.alignment)
        ? parsed.alignment
        : 'ON_TRACK',
      mocked: false,
    };
  } catch (err) {
    logger.error(`Error generando feedback del coach: ${err.message}`);
    return buildMockCoachFeedback(meal, user, today);
  }
}

const INGREDIENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recognized: { type: 'BOOLEAN' },
    calories: { type: 'NUMBER' },
    proteinG: { type: 'NUMBER' },
    carbsG: { type: 'NUMBER' },
    fatG: { type: 'NUMBER' },
  },
  required: ['recognized', 'calories', 'proteinG', 'carbsG', 'fatG'],
};

/**
 * Calcula los macros de UN ingrediente por su nombre y peso. Se usa cuando
 * el usuario corrige el nombre de un ingrediente que la IA detectó mal
 * (ej. "milanesa de carne" → "milanesa de pollo").
 * @returns {Promise<{recognized: boolean, grams, calories, proteinG, carbsG, fatG}>}
 */
async function estimateIngredientNutrition(name, grams) {
  if (!env.gemini.isConfigured) {
    const err = new Error('El recálculo automático necesita la GEMINI_API_KEY configurada en el backend.');
    err.status = 503;
    throw err;
  }

  const prompt = `Sos un sistema de información nutricional. Calculá las calorías (kcal), proteínas,
carbohidratos y grasas (en gramos) de ${grams} g de "${name}", tal como se come normalmente
(si es una preparación cocida, frita o al horno, considerala así). Usá valores de tablas
nutricionales estándar (USDA / tablas argentinas). Los números deben ser coherentes:
calorías ≈ 4*proteína + 4*carbohidratos + 9*grasa.
Si "${name}" no es un alimento o bebida reconocible, devolvé recognized=false y todo en 0.`;

  let parsed;
  try {
    parsed = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: INGREDIENT_SCHEMA,
      },
    });
  } catch (err) {
    logger.error(`Error recalculando ingrediente "${name}": ${err.message}`);
    const friendly = new Error(err.httpStatus === 429
      ? 'Se alcanzó el límite de uso de la IA por ahora. Esperá un minuto y probá de nuevo.'
      : 'No pudimos recalcular el ingrediente en este momento. Probá de nuevo.');
    friendly.status = err.httpStatus === 429 ? 429 : 502;
    throw friendly;
  }

  return {
    recognized: parsed.recognized !== false,
    grams,
    calories: Math.round(num(parsed.calories, 5000)),
    proteinG: num(parsed.proteinG, 500),
    carbsG: num(parsed.carbsG, 1000),
    fatG: num(parsed.fatG, 500),
  };
}

// ------------------------------------------------------------------
// Modo simulado (mock): SOLO se usa si no hay GEMINI_API_KEY cargada.
// ------------------------------------------------------------------
const MOCK_PLATES = [
  {
    dishName: 'Pollo con arroz y brócoli',
    ingredients: [
      { name: 'Pechuga de pollo grillada', grams: 150, calories: 248, proteinG: 46, carbsG: 0, fatG: 5 },
      { name: 'Arroz blanco cocido', grams: 120, calories: 156, proteinG: 3, carbsG: 34, fatG: 0.3 },
      { name: 'Brócoli al vapor', grams: 80, calories: 27, proteinG: 2.2, carbsG: 5.6, fatG: 0.3 },
    ],
  },
  {
    dishName: 'Salmón con puré',
    ingredients: [
      { name: 'Salmón al horno', grams: 130, calories: 271, proteinG: 28, carbsG: 0, fatG: 17 },
      { name: 'Puré de papas', grams: 150, calories: 130, proteinG: 2.6, carbsG: 27, fatG: 1.4 },
      { name: 'Ensalada de hojas verdes', grams: 60, calories: 12, proteinG: 1, carbsG: 2.2, fatG: 0.2 },
    ],
  },
];

function buildMockAnalysis() {
  const plate = MOCK_PLATES[Math.floor(Math.random() * MOCK_PLATES.length)];
  return {
    ingredients: sanitizeIngredients(plate.ingredients),
    dishName: plate.dishName,
    isFood: true,
    raw: { mocked: true, plate },
    mocked: true,
  };
}

// Devolución de respaldo, calculada con reglas simples y solo a partir de
// números reales (sin inventar cosas sobre el plato). Se usa si no hay
// API key o si Gemini no responde; el frontend avisa que es "básica".
function buildMockCoachFeedback(meal, user, today = null) {
  const goal = Number(user.dailyCalorieGoal) || 0;
  const dayTotal = (Number(meal.totalCalories) || 0) + (Number(today?.totalCalories) || 0);
  const protein = Number(meal.totalProteinG) || 0;

  let alignment = 'ON_TRACK';
  let summary = goal
    ? `Con este plato llevarías ${Math.round(dayTotal)} de ${Math.round(goal)} kcal de tu meta de hoy.`
    : `Este plato aporta ${Math.round(meal.totalCalories || 0)} kcal.`;
  const tips = [];

  if (goal && dayTotal > goal) {
    alignment = 'NEEDS_ADJUSTMENT';
    summary = `Con este plato superarías tu meta de hoy: ${Math.round(dayTotal)} de ${Math.round(goal)} kcal.`;
    tips.push('Si podés, reducí la porción o elegí algo más liviano para lo que queda del día.');
  } else if (goal) {
    tips.push(`Te quedarían unas ${Math.round(goal - dayTotal)} kcal para el resto del día.`);
  }
  if (protein < 20) {
    tips.push('Este plato tiene poca proteína: sumá huevo, carne magra, lácteos o legumbres.');
  }
  tips.push('Sumá verduras o legumbres para aportar fibra.');

  return { summary, tips: tips.slice(0, 3), alignment, mocked: true };
}

module.exports = {
  analyzeMealImage,
  generateCoachFeedback,
  estimateIngredientNutrition,
  // Usado por el generador de recetas (services/recipeAi.service.js)
  generateWithFallback,
  GOAL_LABELS,
};

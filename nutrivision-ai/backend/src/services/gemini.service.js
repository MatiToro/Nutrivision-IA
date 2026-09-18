const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');
const logger = require('../utils/logger');

let client = null;
if (env.gemini.isConfigured) {
  client = new GoogleGenerativeAI(env.gemini.apiKey);
}

const VISION_PROMPT = `Sos un sistema de análisis nutricional por visión artificial.
Vas a recibir la foto de un plato de comida. Identificá cada ingrediente visible,
estimá su peso en gramos y calculá sus macronutrientes.

Respondé EXCLUSIVAMENTE con un JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{
  "ingredients": [
    { "name": "string", "grams": number, "calories": number, "proteinG": number, "carbsG": number, "fatG": number }
  ]
}

Si no podés identificar el plato con confianza, devolvé "ingredients": [].`;

/**
 * Analiza una imagen de un plato de comida.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @returns {Promise<{ingredients: Array, raw: object, mocked: boolean}>}
 */
async function analyzeMealImage(imageBuffer, mimeType) {
  if (!client) {
    logger.debug('GEMINI_API_KEY no configurada: devolviendo análisis simulado.');
    return buildMockAnalysis();
  }

  try {
    const model = client.getGenerativeModel({ model: env.gemini.model });

    const result = await model.generateContent([
      { text: VISION_PROMPT },
      { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
    ]);

    const text = result.response.text().trim();
    const jsonText = text.replace(/^```json\s*|```$/g, '').trim();
    const parsed = JSON.parse(jsonText);

    return {
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      raw: parsed,
      mocked: false,
    };
  } catch (err) {
    logger.error(`Error llamando a Gemini Vision: ${err.message}`);
    const err2 = new Error('No pudimos analizar la imagen en este momento. Probá de nuevo.');
    err2.status = 502;
    throw err2;
  }
}

/**
 * Genera el texto de devolución del Coach IA cruzando el plato con los
 * objetivos del usuario. Si Gemini no está configurado, usa una
 * heurística simple basada en reglas para no dejar la feature muda.
 */
async function generateCoachFeedback(meal, user) {
  if (!client) {
    return buildMockCoachFeedback(meal, user);
  }

  try {
    const model = client.getGenerativeModel({ model: env.gemini.model });

    const prompt = `Sos un coach nutricional breve y directo, con tono motivador (no clínico).
Datos del plato: ${meal.totalCalories} kcal, ${meal.totalProteinG}g proteína, ${meal.totalCarbsG}g carbohidratos, ${meal.totalFatG}g grasas.
Meta diaria del usuario: ${user.dailyCalorieGoal || 'sin definir'} kcal, objetivo: ${user.goal || 'sin definir'}.
Respondé EXCLUSIVAMENTE en JSON: {"summary": "1-2 frases", "tips": ["consejo corto 1", "consejo corto 2"], "alignment": "ON_TRACK|NEEDS_ADJUSTMENT|OFF_TRACK"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/^```json\s*|```$/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    logger.error(`Error generando feedback del coach: ${err.message}`);
    return buildMockCoachFeedback(meal, user);
  }
}

// ------------------------------------------------------------------
// Modo simulado (mock): permite demostrar el flujo end-to-end sin
// necesidad de una API key real de Gemini. Misma forma de respuesta
// que el modo real, así el resto del sistema no distingue entre ambos.
// ------------------------------------------------------------------
const MOCK_PLATES = [
  {
    ingredients: [
      { name: 'Pechuga de pollo grillada', grams: 150, calories: 248, proteinG: 46, carbsG: 0, fatG: 5 },
      { name: 'Arroz blanco cocido', grams: 120, calories: 156, proteinG: 3, carbsG: 34, fatG: 0.3 },
      { name: 'Brócoli al vapor', grams: 80, calories: 27, proteinG: 2.2, carbsG: 5.6, fatG: 0.3 },
    ],
  },
  {
    ingredients: [
      { name: 'Salmón al horno', grams: 130, calories: 271, proteinG: 28, carbsG: 0, fatG: 17 },
      { name: 'Puré de papas', grams: 150, calories: 130, proteinG: 2.6, carbsG: 27, fatG: 1.4 },
      { name: 'Ensalada de hojas verdes', grams: 60, calories: 12, proteinG: 1, carbsG: 2.2, fatG: 0.2 },
    ],
  },
  {
    ingredients: [
      { name: 'Milanesa de carne al horno', grams: 140, calories: 289, proteinG: 32, carbsG: 12, fatG: 12 },
      { name: 'Ensalada mixta (tomate, lechuga, cebolla)', grams: 100, calories: 22, proteinG: 1, carbsG: 4, fatG: 0.2 },
    ],
  },
];

function buildMockAnalysis() {
  const plate = MOCK_PLATES[Math.floor(Math.random() * MOCK_PLATES.length)];
  return { ingredients: plate.ingredients, raw: { mocked: true, plate }, mocked: true };
}

function buildMockCoachFeedback(meal, user) {
  const goal = user.dailyCalorieGoal;
  const calories = meal.totalCalories || 0;

  let alignment = 'ON_TRACK';
  let summary = 'Este plato tiene un buen balance de macronutrientes para tu objetivo actual.';
  const tips = ['Sumá una fuente de fibra (verdura o legumbre) en la próxima comida.'];

  if (goal && calories > goal * 0.5) {
    alignment = 'NEEDS_ADJUSTMENT';
    summary = 'Este plato representa una porción grande de tu meta calórica diaria.';
    tips.push('Considerá reducir la porción de carbohidratos en tu próxima comida de hoy.');
  } else {
    tips.push('Buen aporte de proteína: te ayuda a mantener la saciedad.');
  }

  return { summary, tips, alignment, mocked: true };
}

module.exports = { analyzeMealImage, generateCoachFeedback };
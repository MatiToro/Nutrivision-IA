const env = require('../config/env');
const logger = require('../utils/logger');

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const SEARCH_URL = 'https://platform.fatsecret.com/rest/foods/search/v1';

let cachedToken = null;
let cachedTokenExpiresAt = 0;

/**
 * FatSecret usa OAuth2 "client credentials" para server-to-server.
 * Cacheamos el token en memoria hasta que expire para no pedir uno
 * nuevo en cada request (buena práctica y evita rate-limit).
 */
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

module.exports = { searchFood };
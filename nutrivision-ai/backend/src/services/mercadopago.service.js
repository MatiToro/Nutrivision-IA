const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../utils/logger');

// Cliente mínimo de la API de Mercado Pago (suscripciones).
// Doc: https://www.mercadopago.com.ar/developers/es/docs/subscriptions
const API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15000;

class MercadoPagoError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, idempotencyKey } = {}) {
  if (!env.mercadoPago.isConfigured) {
    throw new MercadoPagoError('Mercado Pago no está configurado (falta MP_ACCESS_TOKEN).', { status: 503 });
  }
  const headers = {
    Authorization: `Bearer ${env.mercadoPago.accessToken}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new MercadoPagoError(`No se pudo conectar con Mercado Pago (${err.name === 'AbortError' ? 'timeout' : err.message}).`, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.message || data?.error || `HTTP ${res.status}`;
    logger.warn(`Mercado Pago ${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
    throw new MercadoPagoError(`Mercado Pago rechazó el pedido: ${detail}`, { status: res.status, body: data });
  }
  return data;
}

const createPreapproval = (body, idempotencyKey) => request('/preapproval', { method: 'POST', body, idempotencyKey });
const getPreapproval = (id) => request(`/preapproval/${encodeURIComponent(id)}`);
const cancelPreapproval = (id) => request(`/preapproval/${encodeURIComponent(id)}`, { method: 'PUT', body: { status: 'cancelled' } });
const getAuthorizedPayment = (id) => request(`/authorized_payments/${encodeURIComponent(id)}`);

// Cobros de una suscripción. Si la búsqueda falla, se devuelve [] (los cobros
// también llegan uno por uno por webhook).
async function searchAuthorizedPayments(preapprovalId) {
  try {
    const data = await request(`/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&limit=50`);
    return Array.isArray(data?.results) ? data.results : [];
  } catch (err) {
    logger.warn(`No se pudieron listar los cobros de ${preapprovalId}: ${err.message}`);
    return [];
  }
}

/**
 * Valida la firma de un webhook (header x-signature: "ts=...,v1=...").
 * Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" con HMAC-SHA256
 * y la clave secreta de Webhooks. Las partes que no vienen se omiten.
 */
function verifyWebhookSignature({ signature, requestId, dataId, secret }) {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(String(signature).split(',').map((kv) => {
    const [k, ...v] = kv.split('=');
    return [k.trim(), v.join('=').trim()];
  }));
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  let manifest = '';
  // Los ids alfanuméricos se firman en minúsculas.
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  MercadoPagoError,
  createPreapproval,
  getPreapproval,
  cancelPreapproval,
  getAuthorizedPayment,
  searchAuthorizedPayments,
  verifyWebhookSignature,
};

const prisma = require('../config/prisma');
const env = require('../config/env');
const logger = require('../utils/logger');
const mp = require('../services/mercadopago.service');
const subs = require('../services/subscription.service');

// Suscripciones con Mercado Pago: Pro mensual, Pro anual (7 días gratis la
// primera vez) y la suscripción mensual del nutricionista.

function baseUrl(req) {
  return env.publicApiUrl || `${req.protocol}://${req.get('host')}`;
}

function sendError(res, err) {
  if (err instanceof subs.SubscriptionError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err instanceof mp.MercadoPagoError) {
    const status = err.status === 503 ? 503 : 502;
    return res.status(status).json({
      error: err.status === 503
        ? 'Los pagos con Mercado Pago todavía no están configurados en el servidor.'
        : 'No pudimos comunicarnos con Mercado Pago. Probá de nuevo en unos minutos.',
    });
  }
  throw err;
}

async function respondSummary(req, res, extra = {}) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const summary = await subs.summaryFor(user);
  res.json({ ...summary, user, ...extra });
}

// GET /api/payments/me
// Si quedó un intento de pago "pendiente" de las últimas 48 h, se vuelve a
// consultar a Mercado Pago antes de responder. Así el plan se activa al abrir
// la pantalla aunque la app haya preguntado demasiado pronto al volver del
// checkout o el webhook no haya llegado.
async function getMine(req, res) {
  const pending = await prisma.subscription.findFirst({
    where: {
      userId: req.user.id,
      status: 'PENDING',
      mpPreapprovalId: { not: null },
      createdAt: { gt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (pending) {
    await subs.syncSubscription(pending)
      .catch((err) => logger.warn(`No se pudo re-sincronizar ${pending.id}: ${err.message}`));
  }
  return respondSummary(req, res);
}

// POST /api/payments/subscriptions  { kind }
async function createSubscription(req, res) {
  try {
    const sub = await subs.createSubscription(req.user, req.body.kind, { baseUrl: baseUrl(req) });
    res.status(201).json({ subscriptionId: sub.id, initPoint: sub.initPoint, withTrial: sub.withTrial });
  } catch (err) {
    sendError(res, err);
  }
}

async function ownSubscription(req, res) {
  const sub = await prisma.subscription.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!sub) res.status(404).json({ error: 'No encontramos esa suscripción.' });
  return sub;
}

// POST /api/payments/subscriptions/:id/sync
// La app lo llama al volver de Mercado Pago, sin esperar al webhook.
async function syncSubscription(req, res) {
  const sub = await ownSubscription(req, res);
  if (!sub) return undefined;
  try {
    const updated = await subs.syncSubscription(sub);
    return respondSummary(req, res, { synced: subs.publicSubscription(updated) });
  } catch (err) {
    return sendError(res, err);
  }
}

// POST /api/payments/subscriptions/:id/cancel
async function cancelSubscription(req, res) {
  const sub = await ownSubscription(req, res);
  if (!sub) return undefined;
  try {
    await subs.cancelSubscription(sub);
    logger.info(`Suscripción ${sub.id} cancelada por el usuario ${req.user.id}`);
    return respondSummary(req, res);
  } catch (err) {
    return sendError(res, err);
  }
}

// POST /api/payments/webhook  (Mercado Pago -> backend, sin sesión)
// Se valida la firma y, de todas formas, el estado real siempre se vuelve a
// pedir a la API de Mercado Pago: una notificación falsa no da acceso.
async function webhook(req, res) {
  const type = req.body?.type || req.query.type || req.query.topic;
  const dataId = req.query['data.id'] || req.body?.data?.id || req.query.id;

  if (env.mercadoPago.webhookSecret) {
    const valid = mp.verifyWebhookSignature({
      signature: req.get('x-signature'),
      requestId: req.get('x-request-id'),
      dataId: dataId ? String(dataId) : null,
      secret: env.mercadoPago.webhookSecret,
    });
    if (!valid) {
      logger.warn(`Webhook de Mercado Pago con firma inválida (type=${type}, id=${dataId})`);
      return res.status(401).json({ error: 'Firma inválida.' });
    }
  } else {
    logger.warn('MP_WEBHOOK_SECRET no está configurada: el webhook no valida la firma.');
  }

  if (!dataId) return res.status(200).json({ ok: true, ignored: true });

  try {
    let sub = null;
    if (type === 'subscription_preapproval' || type === 'preapproval') {
      sub = await subs.findByPreapproval(dataId);
      if (!sub) {
        const pre = await mp.getPreapproval(dataId);
        sub = await subs.findByPreapproval(pre.id, pre.external_reference);
      }
    } else if (type === 'subscription_authorized_payment' || type === 'authorized_payment') {
      const ap = await mp.getAuthorizedPayment(dataId);
      sub = await subs.findByPreapproval(ap.preapproval_id, ap.external_reference);
    } else {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (!sub) {
      logger.warn(`Webhook ${type} ${dataId}: no corresponde a ninguna suscripción conocida`);
      return res.status(200).json({ ok: true, ignored: true });
    }
    await subs.syncSubscription(sub);
    return res.status(200).json({ ok: true });
  } catch (err) {
    // 500 => Mercado Pago reintenta la notificación más tarde.
    logger.error(`Error procesando webhook ${type} ${dataId}: ${err.message}`);
    return res.status(500).json({ error: 'No se pudo procesar la notificación.' });
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// GET /api/payments/return?sub=<id>
// Mercado Pago vuelve acá (back_url tiene que ser https). Se sincroniza y se
// redirige a la app (nutrivisionia://...). Si el navegador no abre la app, el
// usuario vuelve a mano y la app sincroniza sola al recuperar.
async function returnPage(req, res) {
  const sub = req.query.sub
    ? await prisma.subscription.findUnique({ where: { id: String(req.query.sub) } }).catch(() => null)
    : null;
  if (sub) await subs.syncSubscription(sub).catch((err) => logger.warn(`Sync al volver de MP falló: ${err.message}`));

  const path = sub?.kind === 'NUTRITIONIST' ? 'suscripcion' : 'premium';
  const deepLink = `nutrivisionia://${path}?pago=volver${sub ? `&sub=${encodeURIComponent(sub.id)}` : ''}`;
  const link = escapeHtml(deepLink);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${link}">
<title>NutriVision IA</title>
<style>body{font-family:system-ui,sans-serif;background:#F4FAF6;color:#1B2A22;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{background:#fff;border-radius:16px;padding:28px 22px;max-width:360px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.06)}
a{display:inline-block;margin-top:14px;background:#1F9D55;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px}</style>
</head><body><main><h2>¡Listo!</h2><p>Volvé a NutriVision IA para ver tu plan.</p><a href="${link}">Abrir la app</a></main></body></html>`);
}

module.exports = { getMine, createSubscription, syncSubscription, cancelSubscription, webhook, returnPage };

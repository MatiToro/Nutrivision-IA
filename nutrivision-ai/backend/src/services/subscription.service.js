const prisma = require('../config/prisma');
const env = require('../config/env');
const logger = require('../utils/logger');
const { randomCode } = require('../utils/codes');
const mp = require('./mercadopago.service');

// ---------------------------------------------------------------------------
// Planes pagos (precios del análisis de negocio, en ARS). Se pueden ajustar
// por variables de entorno sin tocar código (ajuste trimestral por IPC).
// ---------------------------------------------------------------------------
const price = (key, fallback) => {
  const n = parseInt(process.env[key], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const PLANS = {
  PRO_MONTHLY: {
    kind: 'PRO_MONTHLY', group: 'PRO', months: 1, trialDays: 7,
    amount: price('PRICE_PRO_MONTHLY', 6990),
    reason: 'NutriVision Pro — mensual',
  },
  PRO_ANNUAL: {
    kind: 'PRO_ANNUAL', group: 'PRO', months: 12, trialDays: 7,
    amount: price('PRICE_PRO_ANNUAL', 39990),
    reason: 'NutriVision Pro — anual',
  },
  NUTRITIONIST: {
    kind: 'NUTRITIONIST', group: 'NUTRITIONIST', months: 1, trialDays: 0,
    amount: price('PRICE_NUTRITIONIST', 19990),
    reason: 'NutriVision IA — suscripción de nutricionista',
  },
};
const PRO_KINDS = ['PRO_MONTHLY', 'PRO_ANNUAL'];
const groupKinds = (group) => (group === 'PRO' ? PRO_KINDS : ['NUTRITIONIST']);

const PREMIUM_CODES_PER_MONTH = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
// Margen por si el cobro del período nuevo se acredita unas horas tarde.
const GRACE_MS = DAY_MS;

const STATUS_MAP = { pending: 'PENDING', authorized: 'AUTHORIZED', paused: 'PAUSED', cancelled: 'CANCELLED' };

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}
const maxDate = (...dates) => dates.filter(Boolean).map((d) => new Date(d)).reduce((a, b) => (a && a > b ? a : b), null);

class SubscriptionError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** ¿Puede este usuario usar la prueba gratis de Pro? Una sola vez por cuenta. */
async function trialAvailable(user) {
  if (user.proTrialUsedAt) return false;
  const previous = await prisma.subscription.count({
    where: { userId: user.id, kind: { in: PRO_KINDS }, authorizedAt: { not: null } },
  });
  return previous === 0;
}

/** Catálogo de planes para mostrar en la app. */
async function plansFor(user) {
  const trial = user.role === 'USER' ? await trialAvailable(user) : false;
  return Object.values(PLANS)
    .filter((p) => (user.role === 'NUTRITIONIST' ? p.group === 'NUTRITIONIST' : p.group === 'PRO'))
    .map((p) => ({
      kind: p.kind,
      amount: p.amount,
      months: p.months,
      trialDays: p.trialDays && trial ? p.trialDays : 0,
      currency: 'ARS',
    }));
}

const now = () => new Date();
const isLive = (sub, at = now()) => sub.status === 'AUTHORIZED' || (sub.accessUntil && new Date(sub.accessUntil) > at);

/**
 * Crea la suscripción en Mercado Pago (estado "pending") y devuelve el link de
 * pago (init_point), donde el usuario carga la tarjeta. Pro mensual y anual
 * tienen 7 días gratis (una vez por cuenta): Mercado Pago pide la tarjeta pero
 * el primer cobro es al terminar la prueba.
 */
async function createSubscription(user, kind, { baseUrl }) {
  const plan = PLANS[kind];
  if (!plan) throw new SubscriptionError('Plan inválido.', 422);

  if (plan.group === 'PRO' && user.role !== 'USER') {
    throw new SubscriptionError('NutriVision Pro es para cuentas de usuario.', 403);
  }
  if (plan.group === 'NUTRITIONIST') {
    if (user.role !== 'NUTRITIONIST') throw new SubscriptionError('Esta suscripción es para nutricionistas.', 403);
    const profile = await prisma.nutritionistProfile.findUnique({ where: { userId: user.id } });
    if (!profile || profile.status !== 'APPROVED') {
      throw new SubscriptionError('Vas a poder suscribirte cuando un administrador apruebe tu cuenta.', 403);
    }
  }

  const existing = await prisma.subscription.findMany({
    where: { userId: user.id, kind: { in: groupKinds(plan.group) }, status: { in: ['AUTHORIZED', 'PAUSED', 'CANCELLED'] } },
    orderBy: { createdAt: 'desc' },
  });
  const live = existing.find((s) => isLive(s));
  if (live?.status === 'AUTHORIZED') {
    throw new SubscriptionError('Ya tenés una suscripción activa. Si querés cambiar de plan, primero cancelá la actual.', 409, 'ALREADY_ACTIVE');
  }
  if (live) {
    const until = new Date(live.accessUntil).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    throw new SubscriptionError(`Tu plan sigue activo hasta el ${until}. Vas a poder suscribirte de nuevo desde ese día.`, 409, 'STILL_ACTIVE');
  }

  // Si quedaron intentos sin terminar (no cargó la tarjeta), se descartan.
  const pending = await prisma.subscription.findMany({
    where: { userId: user.id, kind: { in: groupKinds(plan.group) }, status: 'PENDING' },
  });
  for (const p of pending) {
    if (p.mpPreapprovalId) {
      // eslint-disable-next-line no-await-in-loop
      await mp.cancelPreapproval(p.mpPreapprovalId).catch(() => {});
    }
  }
  if (pending.length) {
    await prisma.subscription.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: 'CANCELLED', cancelledAt: now() },
    });
  }

  const withTrial = plan.trialDays > 0 && await trialAvailable(user);
  const sub = await prisma.subscription.create({
    data: { userId: user.id, kind, amount: plan.amount, withTrial },
  });

  const autoRecurring = {
    frequency: plan.months,
    frequency_type: 'months',
    transaction_amount: plan.amount,
    currency_id: 'ARS',
  };
  if (withTrial) {
    if (env.mercadoPago.trialMode === 'start_date') {
      autoRecurring.start_date = new Date(Date.now() + plan.trialDays * DAY_MS).toISOString();
    } else {
      autoRecurring.free_trial = { frequency: plan.trialDays, frequency_type: 'days' };
    }
  }

  const back = new URL(`${baseUrl}/api/payments/return`);
  back.searchParams.set('sub', sub.id);

  let pre;
  try {
    pre = await mp.createPreapproval({
      reason: plan.reason,
      external_reference: sub.id,
      payer_email: env.mercadoPago.testPayerEmail || user.email,
      back_url: back.toString(),
      status: 'pending',
      auto_recurring: autoRecurring,
    }, sub.id);
  } catch (err) {
    await prisma.subscription.delete({ where: { id: sub.id } }).catch(() => {});
    throw err;
  }

  const initPoint = pre.init_point || pre.sandbox_init_point;
  if (!pre.id || !initPoint) {
    await prisma.subscription.delete({ where: { id: sub.id } }).catch(() => {});
    throw new SubscriptionError('Mercado Pago no devolvió el link de pago. Probá de nuevo.', 502);
  }

  const saved = await prisma.subscription.update({
    where: { id: sub.id },
    data: { mpPreapprovalId: String(pre.id), initPoint },
  });
  logger.info(`Suscripción ${saved.id} (${kind}${withTrial ? ', con prueba' : ''}) creada en Mercado Pago: ${pre.id}`);
  return saved;
}

/** Crea los 5 códigos Premium de un mes pagado del nutricionista. */
async function createMonthCodes(tx, nutritionistId, periodEnd) {
  const codes = new Set();
  while (codes.size < PREMIUM_CODES_PER_MONTH) codes.add(randomCode(8));
  await tx.premiumCode.createMany({
    data: [...codes].map((code) => ({ code, nutritionistId, periodEnd })),
  });
}

/**
 * Registra los cobros aprobados que todavía no estaban guardados.
 * Para nutricionistas, cada mes pagado genera su NutritionistPayment y sus 5 códigos Premium.
 */
async function importPayments(sub, authorizedPayments) {
  const plan = PLANS[sub.kind];
  const approved = authorizedPayments
    .filter((ap) => ap && ap.id && ap.payment?.status === 'approved')
    .sort((a, b) => new Date(a.debit_date || a.date_created) - new Date(b.debit_date || b.date_created));

  let imported = 0;
  for (const ap of approved) {
    const paidAt = new Date(ap.payment?.date_approved || ap.debit_date || ap.date_created || Date.now());
    try {
      // eslint-disable-next-line no-await-in-loop
      await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            subscriptionId: sub.id,
            userId: sub.userId,
            mpAuthorizedPaymentId: String(ap.id),
            mpPaymentId: ap.payment?.id ? String(ap.payment.id) : null,
            amount: Math.round(Number(ap.transaction_amount) || sub.amount),
            status: 'approved',
            paidAt,
          },
        });
        if (sub.kind === 'NUTRITIONIST') {
          const profile = await tx.nutritionistProfile.findUnique({ where: { userId: sub.userId } });
          if (profile) {
            const periodEnd = addMonths(paidAt, plan.months);
            await tx.nutritionistPayment.create({
              data: {
                nutritionistId: profile.id,
                periodStart: paidAt,
                periodEnd,
                amount: Math.round(Number(ap.transaction_amount) || sub.amount),
                paymentId: String(ap.id),
              },
            });
            await createMonthCodes(tx, profile.id, periodEnd);
          }
        }
      });
      imported += 1;
    } catch (err) {
      if (err.code !== 'P2002') throw err; // P2002 = ya estaba registrado
    }
  }
  return imported;
}

/**
 * Actualiza nuestra suscripción con lo que dice Mercado Pago (fuente de verdad)
 * y le da (o mantiene) el acceso al usuario.
 */
async function applyPreapproval(sub, pre, authorizedPayments = []) {
  const plan = PLANS[sub.kind];
  const at = now();
  const status = STATUS_MAP[pre.status] || sub.status;
  const nextPaymentAt = pre.next_payment_date ? new Date(pre.next_payment_date) : null;

  const imported = await importPayments(sub, authorizedPayments);
  const lastPayment = await prisma.payment.findFirst({ where: { subscriptionId: sub.id }, orderBy: { paidAt: 'desc' } });
  const paidThrough = lastPayment ? addMonths(lastPayment.paidAt, plan.months) : null;

  let trialEndsAt = sub.trialEndsAt;
  if (sub.withTrial && status === 'AUTHORIZED' && !lastPayment && !trialEndsAt) {
    trialEndsAt = nextPaymentAt || new Date(at.getTime() + plan.trialDays * DAY_MS);
  }
  // Con el primer cobro aprobado, la prueba terminó.
  if (trialEndsAt && lastPayment && new Date(trialEndsAt) > lastPayment.paidAt) trialEndsAt = lastPayment.paidAt;

  // Mientras está autorizada, el acceso llega hasta el próximo cobro (que en la
  // prueba gratis es el fin de la prueba). Cancelada o pausada, no se extiende:
  // se conserva lo ya pagado.
  // Si el último cobro falló (Mercado Pago lo reintenta), no se extiende el
  // acceso hasta que se apruebe: queda lo ya pagado o la prueba.
  const latest = [...authorizedPayments]
    .filter((ap) => ap && (ap.debit_date || ap.date_created))
    .sort((a, b) => new Date(b.debit_date || b.date_created) - new Date(a.debit_date || a.date_created))[0];
  const failing = Boolean(latest && latest.payment?.status !== 'approved'
    && (latest.status === 'recycling' || ['rejected', 'cancelled'].includes(latest.payment?.status)));

  let authorizedUntil = null;
  if (status === 'AUTHORIZED' && failing) {
    authorizedUntil = paidThrough || trialEndsAt;
  } else if (status === 'AUTHORIZED') {
    authorizedUntil = nextPaymentAt
      ? new Date(nextPaymentAt.getTime() + GRACE_MS)
      : (paidThrough || trialEndsAt);
  }
  const accessUntil = maxDate(sub.accessUntil, paidThrough, trialEndsAt, authorizedUntil);

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status,
      nextPaymentAt: status === 'AUTHORIZED' ? nextPaymentAt : null,
      trialEndsAt,
      accessUntil,
      authorizedAt: sub.authorizedAt || (status === 'AUTHORIZED' ? at : null),
      cancelledAt: status === 'CANCELLED' ? (sub.cancelledAt || at) : sub.cancelledAt,
    },
  });

  await grantAccess(updated);
  if (imported) logger.info(`Suscripción ${sub.id}: ${imported} cobro(s) nuevo(s) registrado(s)`);
  if (status !== sub.status) logger.info(`Suscripción ${sub.id}: ${sub.status} -> ${status}`);
  return updated;
}

/** Lleva el acceso de la suscripción al usuario (Pro) o al perfil (nutricionista). */
async function grantAccess(sub) {
  if (!sub.accessUntil || new Date(sub.accessUntil) <= now()) return;

  if (PRO_KINDS.includes(sub.kind)) {
    const user = await prisma.user.findUnique({ where: { id: sub.userId } });
    if (!user) return;
    // Pro sin vencimiento (dado por un administrador): no se toca.
    const permanent = user.plan === 'PREMIUM' && !user.planUntil;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: 'PREMIUM',
        planUntil: permanent ? null : maxDate(user.planUntil, sub.accessUntil),
        ...(sub.withTrial && sub.authorizedAt && !user.proTrialUsedAt ? { proTrialUsedAt: sub.authorizedAt } : {}),
      },
    });
  } else {
    const profile = await prisma.nutritionistProfile.findUnique({ where: { userId: sub.userId } });
    if (!profile) return;
    await prisma.nutritionistProfile.update({
      where: { id: profile.id },
      data: { subscriptionUntil: maxDate(profile.subscriptionUntil, sub.accessUntil) },
    });
  }
}

/** Trae el estado y los cobros desde Mercado Pago y actualiza todo. */
async function syncSubscription(sub) {
  if (!sub.mpPreapprovalId) return sub;
  const [pre, payments] = await Promise.all([
    mp.getPreapproval(sub.mpPreapprovalId),
    mp.searchAuthorizedPayments(sub.mpPreapprovalId),
  ]);
  return applyPreapproval(sub, pre, payments);
}

/**
 * Cancela el débito automático. El acceso sigue hasta el final de lo que ya
 * está pago (o de la prueba gratis); los códigos del mes no se borran.
 */
async function cancelSubscription(sub) {
  if (sub.status === 'CANCELLED') return sub;
  if (sub.mpPreapprovalId) {
    try {
      await mp.cancelPreapproval(sub.mpPreapprovalId);
    } catch (err) {
      // Si ya estaba cancelada del lado de Mercado Pago, seguimos con la sincronización.
      if (err.status !== 400 && err.status !== 404) throw err;
    }
    try {
      return await syncSubscription(sub);
    } catch (err) {
      logger.warn(`No se pudo sincronizar ${sub.id} después de cancelar: ${err.message}`);
    }
  }
  return prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'CANCELLED', cancelledAt: now(), nextPaymentAt: null },
  });
}

/** Busca nuestra suscripción a partir de un preapproval de Mercado Pago. */
async function findByPreapproval(preapprovalId, externalReference) {
  if (preapprovalId) {
    const sub = await prisma.subscription.findUnique({ where: { mpPreapprovalId: String(preapprovalId) } });
    if (sub) return sub;
  }
  if (externalReference) return prisma.subscription.findUnique({ where: { id: String(externalReference) } }).catch(() => null);
  return null;
}

/** Baja a Gratuito a quienes se les terminó el Pro pago (cancelado o sin cobro). */
async function expirePlans() {
  const { count } = await prisma.user.updateMany({
    where: { plan: 'PREMIUM', planUntil: { lt: now() } },
    data: { plan: 'FREE' },
  });
  if (count) logger.info(`${count} plan(es) Pro vencido(s) pasaron a Gratuito`);
  return count;
}

/** Resumen para la app: suscripción actual del grupo, planes y últimos pagos. */
async function summaryFor(user) {
  const group = user.role === 'NUTRITIONIST' ? 'NUTRITIONIST' : 'PRO';
  const [subs, payments, plans] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id, kind: { in: groupKinds(group) }, status: { not: 'PENDING' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { paidAt: 'desc' },
      take: 12,
      include: { subscription: { select: { kind: true } } },
    }),
    plansFor(user),
  ]);
  const current = subs.find((s) => isLive(s)) || null;
  return {
    subscription: current ? publicSubscription(current) : null,
    plans,
    payments: payments.map((p) => ({
      id: p.id, amount: p.amount, paidAt: p.paidAt, kind: p.subscription.kind, status: p.status,
    })),
    configured: env.mercadoPago.isConfigured,
  };
}

function publicSubscription(s) {
  const at = now();
  return {
    id: s.id,
    kind: s.kind,
    status: s.status,
    amount: s.amount,
    inTrial: Boolean(s.trialEndsAt && new Date(s.trialEndsAt) > at && s.status !== 'PENDING'),
    trialEndsAt: s.trialEndsAt,
    nextPaymentAt: s.status === 'AUTHORIZED' ? s.nextPaymentAt : null,
    accessUntil: s.accessUntil,
    active: isLive(s, at),
    cancelled: s.status === 'CANCELLED' || s.status === 'PAUSED',
  };
}

module.exports = {
  PLANS,
  PRO_KINDS,
  SubscriptionError,
  createSubscription,
  syncSubscription,
  applyPreapproval,
  cancelSubscription,
  findByPreapproval,
  expirePlans,
  summaryFor,
  publicSubscription,
  addMonths,
};

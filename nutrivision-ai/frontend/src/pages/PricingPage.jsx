import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown, Sprout, Leaf, ArrowRight, Info, Smartphone, X, Gift } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { Message } from '../components/ui';

// Mismas funciones que muestra la app mobile (Plan y suscripción).
const FEATURES = [
  { label: 'Escaneos de platos con IA', free: '3 por día', pro: 'ilimitados' },
  { label: 'Coach IA en cada escaneo', free: true, pro: true },
  { label: 'Heladera y lista de compras', free: true, pro: true },
  { label: 'Agua, rachas e historial', free: true, pro: true },
  { label: 'Recetas con tu heladera', free: false, pro: true },
  { label: 'Faltantes a la lista en 1 toque', free: false, pro: true },
  { label: 'Acceso a nutricionistas profesionales', free: false, pro: true },
  { label: 'Sin anuncios', free: false, pro: true },
];

// Precios de NutriVision Pro (los reales los manda el backend en GET /payments/me).
const DEFAULT_PRICES = { monthly: 6990, annual: 39990, trialDays: 7 };
const formatARS = (n) => `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/** Lista de funciones de un plan: tilde verde si la incluye, cruz gris si no. */
function FeatureList({ plan }) {
  return (
    <ul className="plan-card__features">
      {FEATURES.map((f) => {
        const value = f[plan];
        const included = Boolean(value);
        return (
          <li key={f.label} className={included ? '' : 'is-missing'}>
            {included
              ? <Check size={18} strokeWidth={2.6} aria-label="Incluido" />
              : <X size={18} strokeWidth={2.4} aria-label="No incluido" />}
            <span>
              {f.label}
              {typeof value === 'string' && <span className="plan-card__detail">({value})</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function PricingPage() {
  const { profile } = useAuth();
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [billing, setBilling] = useState('monthly');

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    try {
      const { data } = await apiClient.get('/plan');
      setPlanData(data);
      // Precios y prueba gratis vigentes.
      apiClient.get('/payments/me').then(({ data: pay }) => {
        const monthly = pay?.plans?.find((x) => x.kind === 'PRO_MONTHLY');
        const annual = pay?.plans?.find((x) => x.kind === 'PRO_ANNUAL');
        if (monthly && annual) {
          setPrices({ monthly: monthly.amount, annual: annual.amount, trialDays: Math.max(monthly.trialDays, annual.trialDays) });
        }
      }).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen label="Cargando tu plan…" />;

  // Pro efectivo: plan pago o código de nutricionista vigente (lo calcula el backend).
  const isPremium = planData?.isPremium ?? ((planData?.plan || profile?.plan) === 'PREMIUM');
  const isFree = !isPremium;
  const byCode = isPremium && planData?.plan !== 'PREMIUM' && planData?.premiumUntil;
  const annualSaving = Math.round((1 - prices.annual / (prices.monthly * 12)) * 100);
  const isAnnual = billing === 'annual';
  const usagePct = planData
    ? Math.min((planData.scansToday / planData.freeDailyScanLimit) * 100, 100)
    : 0;

  return (
    <div className="page pricing-page">
      {/* Hero */}
      <div className="pricing-page__hero">
        <img
          src="/pricing-hero.jpg"
          alt="Planes y precios — Elige el plan que mejor se adapte a tus objetivos"
        />
      </div>

      {error && <Message>{error}</Message>}

      {/* En la Web solo se ven los planes: Pro se contrata o se cancela desde la app */}
      <section className="card pricing-page__app-only">
        <span className="icon-tile icon-tile--gradient"><Smartphone size={22} /></span>
        <div className="pricing-page__app-only-text">
          <strong>NutriVision Pro se contrata desde la app</strong>
          <span>
            Desde la web podés ver los planes y sus precios. Para suscribirte, cancelar o canjear el código de tu
            nutricionista, usá la app en tu celular.
            {byCode ? ` Tenés Pro gracias a un código hasta el ${new Date(planData.premiumUntil).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}
          </span>
        </div>
        <Link to="/download" className="btn btn-primary pricing-page__app-only-btn">
          Descargar la app <ArrowRight size={16} />
        </Link>
      </section>

      <div className="pricing-page__grid">
        {/* Plan Gratis */}
        <section className={`plan-card${isFree ? ' is-current' : ''}`}>
          <Leaf className="plan-card__leaf" size={120} strokeWidth={1} aria-hidden="true" />

          <header className="plan-card__head">
            <span className="plan-card__icon plan-card__icon--free">
              <Sprout size={24} strokeWidth={2.2} />
            </span>
            <div>
              <h2>Gratis</h2>
              <p>Ideal para comenzar y probar.</p>
            </div>
          </header>

          <p className="plan-card__price">
            <span className="plan-card__amount">$0</span>
            <span className="plan-card__period">/ mes</span>
          </p>

          <FeatureList plan="free" />

          {isFree && planData && (
            <div className="plan-card__usage">
              <div className="plan-card__usage-row">
                <span>Escaneos de hoy</span>
                <span className="mono-num">
                  {planData.scansToday} / {planData.freeDailyScanLimit}
                </span>
              </div>
              <div className="plan-card__usage-track">
                <div className="plan-card__usage-fill" style={{ width: `${usagePct}%` }} />
              </div>
            </div>
          )}

          {isFree ? (
            <button type="button" className="plan-card__btn plan-card__btn--outline" disabled>
              Tu plan actual
            </button>
          ) : null}
        </section>

        {/* Plan Premium */}
        <section className={`plan-card plan-card--premium${!isFree ? ' is-current' : ''}`}>
          <span className="plan-card__badge">
            <Crown size={14} fill="currentColor" />
            Más popular
          </span>
          <Leaf className="plan-card__leaf" size={120} strokeWidth={1} aria-hidden="true" />

          <header className="plan-card__head">
            <span className="plan-card__icon plan-card__icon--premium">
              <Crown size={24} strokeWidth={2.2} />
            </span>
            <div>
              <h2>Premium</h2>
              <p>Para quienes quieren resultados reales.</p>
            </div>
          </header>

          <div className="plan-card__billing" role="radiogroup" aria-label="Forma de pago">
            <button
              type="button"
              role="radio"
              aria-checked={!isAnnual}
              className={!isAnnual ? 'is-active' : ''}
              onClick={() => setBilling('monthly')}
            >
              Mensual
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isAnnual}
              className={isAnnual ? 'is-active' : ''}
              onClick={() => setBilling('annual')}
            >
              Anual <span className="plan-card__save">-{annualSaving}%</span>
            </button>
          </div>

          <p className="plan-card__price plan-card__price--tight">
            <span className="plan-card__amount">{formatARS(isAnnual ? prices.annual : prices.monthly)}</span>
            <span className="plan-card__period">{isAnnual ? '/ año' : '/ mes'}</span>
          </p>
          <p className="plan-card__price-note">
            {isAnnual
              ? `Equivale a ${formatARS(prices.annual / 12)} por mes · ahorrás ${annualSaving}% frente al plan mensual`
              : `O ${formatARS(prices.annual)} por año (ahorrás ${annualSaving}%)`}
          </p>
          {prices.trialDays > 0 && !isPremium ? (
            <p className="plan-card__trial">
              <Gift size={16} />
              <span><strong>{prices.trialDays} días gratis</strong> para probar Pro. Si cancelás antes, no pagás nada.</span>
            </p>
          ) : null}

          <FeatureList plan="pro" />

          {!isFree ? (
            <button type="button" className="plan-card__btn plan-card__btn--outline" disabled>
              {byCode ? 'Tu plan actual (código)' : 'Tu plan actual'}
            </button>
          ) : (
            <Link to="/download" className="plan-card__btn plan-card__btn--solid">
              <Smartphone size={18} /> Contratalo desde la app
            </Link>
          )}
        </section>
      </div>

      <p className="pricing-page__demo-note">
        <Info size={14} />
        La suscripción a Pro se contrata desde la app mobile y se paga con Mercado Pago, con débito automático
        mensual o anual. La primera vez tenés {DEFAULT_PRICES.trialDays} días de prueba gratis: se pide una tarjeta,
        pero el primer cobro es al terminar la prueba. Podés cancelar cuando quieras desde la app.
      </p>

      <style>{`

        /* ---- Hero ---- */
        .pricing-page__hero {
          border-radius: var(--radius-lg); overflow: hidden;
          background: #EEF8F0; box-shadow: var(--shadow-card);
        }
        .pricing-page__hero img { width: 100%; height: auto; display: block; }

        .pricing-page__error { margin: 0 0 16px; }

        /* ---- Grid ---- */
        .pricing-page__grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 28px;
          align-items: stretch; padding: 0 12px;
        }
        @media (max-width: 860px) {
          .pricing-page__grid { grid-template-columns: 1fr; padding: 0; gap: 24px; }
        }

        /* ---- Card ---- */
        .plan-card {
          position: relative; display: flex; flex-direction: column;
          background: var(--color-surface);
          border: 2px solid transparent;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-card);
          padding: 30px 30px 30px;
        }
        .plan-card--premium {
          border: 2px solid var(--color-primary);
          box-shadow: 0 2px 4px rgba(24,155,78,0.05), 0 18px 44px rgba(24,155,78,0.12);
        }

        .plan-card__leaf {
          position: absolute; top: 18px; right: 18px;
          color: var(--color-primary); opacity: 0.09;
          transform: rotate(-18deg); pointer-events: none;
        }

        .plan-card__badge {
          position: absolute; top: -15px; right: 36px;
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--color-primary-dark); color: #fff;
          font-size: 0.8rem; font-weight: 600;
          padding: 6px 14px; border-radius: 999px;
          box-shadow: 0 4px 12px rgba(14,122,58,0.25);
        }
        .plan-card__badge svg { color: #F5C542; }

        .plan-card__head { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; position: relative; }
        .plan-card__head h2 { margin: 0 0 2px; font-size: 1.5rem; font-weight: 800; }
        .plan-card__head p { margin: 0; color: var(--color-ink-soft); font-size: 0.95rem; }

        .plan-card__icon {
          width: 58px; height: 58px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .plan-card__icon--free { background: var(--color-primary-soft); color: var(--color-primary); }
        .plan-card__icon--premium {
          background: var(--gradient-primary); color: #F5C542;
          box-shadow: 0 6px 16px rgba(24,155,78,0.3);
        }

        .plan-card__price { display: flex; align-items: baseline; gap: 12px; margin: 0 0 26px; }
        .plan-card__amount {
          font-size: 2.9rem; font-weight: 700; line-height: 1;
          letter-spacing: -0.03em; color: var(--color-ink); font-weight: 800;
        }
        .plan-card__period { font-size: 1.05rem; color: var(--color-ink-soft); }
        .plan-card__price--tight { margin-bottom: 6px; }
        .plan-card__price-note { margin: 0 0 14px; font-size: 0.9rem; color: var(--color-ink-soft); }

        .plan-card__billing {
          display: inline-flex; align-self: flex-start; gap: 4px; padding: 4px; margin: -8px 0 18px;
          background: var(--color-bg, #F6F7F9); border: 1px solid var(--color-line); border-radius: 999px;
        }
        .plan-card__billing button {
          border: none; background: transparent; cursor: pointer; border-radius: 999px;
          padding: 7px 16px; font-size: 0.9rem; font-weight: 700; color: var(--color-ink-soft);
          display: inline-flex; align-items: center; gap: 6px;
        }
        .plan-card__billing button.is-active {
          background: var(--color-surface); color: var(--color-ink); box-shadow: 0 1px 4px rgba(23,25,28,0.12);
        }
        .plan-card__save {
          font-size: 0.75rem; font-weight: 800; color: var(--color-primary-dark);
          background: var(--color-primary-soft); border-radius: 999px; padding: 2px 7px;
        }

        .plan-card__trial {
          display: flex; align-items: flex-start; gap: 8px; margin: 0 0 22px;
          padding: 10px 12px; border-radius: var(--radius-md);
          background: #FBF0D9; color: #6B4C0E; font-size: 0.9rem; line-height: 1.4;
        }
        .plan-card__trial svg { flex-shrink: 0; margin-top: 1px; color: #D9A02C; }

        .plan-card__features { list-style: none; padding: 0; margin: 0 0 28px; flex: 1; }
        .plan-card__features li {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 8px 0; font-size: 1rem; color: var(--color-ink); line-height: 1.4;
        }
        .plan-card__features svg { color: var(--color-primary); flex-shrink: 0; margin-top: 1px; }
        .plan-card__features li.is-missing { color: var(--color-ink-soft); }
        .plan-card__features li.is-missing svg { color: var(--color-ink-muted, #9AA0A8); }
        .plan-card__detail { display: block; }

        .plan-card__usage {
          background: var(--color-primary-soft); border-radius: var(--radius-md);
          padding: 12px 14px; margin: -8px 0 20px;
        }
        .plan-card__usage-row {
          display: flex; justify-content: space-between; font-size: 0.85rem;
          font-weight: 600; color: var(--color-primary-dark); margin-bottom: 8px;
        }
        .plan-card__usage-track { height: 6px; background: rgba(255,255,255,0.8); border-radius: 999px; overflow: hidden; }
        .plan-card__usage-fill { height: 100%; background: var(--gradient-primary); border-radius: 999px; transition: width 0.4s ease; }

        .plan-card__btn {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          padding: 14px 22px; border-radius: var(--radius-md); font-size: 1rem; font-weight: 800;
          cursor: pointer; transition: filter 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .plan-card__btn--outline {
          background: var(--color-surface); color: var(--color-primary);
          border: 1.5px solid var(--color-line);
        }
        .plan-card__btn--outline:hover:not(:disabled) { background: var(--color-primary-soft); border-color: var(--color-primary); }
        .plan-card__btn--outline:disabled { cursor: default; }
        .plan-card__btn--solid {
          background: var(--gradient-primary); color: #fff; border: none;
          box-shadow: 0 8px 20px rgba(24,155,78,0.28);
        }
        .plan-card__btn--solid:hover:not(:disabled) { filter: brightness(1.06); }
        .plan-card__btn:disabled:not(.plan-card__btn--outline) { opacity: 0.6; cursor: not-allowed; }

        .pricing-page__app-only { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: 0 12px; }
        @media (max-width: 860px) { .pricing-page__app-only { margin: 0; } }
        .pricing-page__app-only-text { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 2px; }
        .pricing-page__app-only-text strong { font-size: 1rem; font-weight: 800; }
        .pricing-page__app-only-text span { font-size: 0.86rem; color: var(--color-ink-soft); line-height: 1.45; }
        .plan-card__btn { text-decoration: none; }
        .pricing-page__demo-note {
          display: flex; align-items: flex-start; gap: 7px; margin: 0 12px;
          font-size: 0.8rem; color: var(--color-ink-soft); line-height: 1.5;
        }
        .pricing-page__demo-note svg { flex-shrink: 0; margin-top: 2px; }
      `}
      </style>
    </div>
  );
}

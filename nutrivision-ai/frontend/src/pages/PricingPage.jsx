import { useEffect, useState } from 'react';
import { Check, X, Sparkles, Info } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

const FEATURES = [
  { label: 'Escaneo de platos con IA', free: '3 por día', premium: 'Ilimitado' },
  { label: 'Desglose nutricional completo', free: true, premium: true },
  { label: 'Ajuste manual de ingredientes', free: true, premium: true },
  { label: 'Devolución del Coach IA', free: true, premium: true },
  { label: 'Historial nutricional', free: true, premium: true },
  { label: 'Seguimiento de peso y metas', free: true, premium: true },
  { label: 'Metas de macros personalizables', free: false, premium: true },
  { label: 'Racha diaria', free: true, premium: true },
  { label: 'App mobile (iOS y Android)', free: true, premium: true },
];

export default function PricingPage() {
  const { profile, setProfile } = useAuth();
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    try {
      const { data } = await apiClient.get('/plan');
      setPlanData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function switchPlan(plan) {
    setSwitching(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/plan', { plan });
      setProfile(data.user);
      await loadPlan();
    } catch (err) {
      setError(err.message);
    } finally {
      setSwitching(false);
    }
  }

  if (loading) return <LoadingScreen label="Cargando tu plan…" />;

  const currentPlan = planData?.plan || profile?.plan || 'FREE';
  const isFree = currentPlan === 'FREE';

  return (
    <div className="container pricing-page">
      <div className="pricing-page__header">
        <h1>Precios</h1>
        <p className="helper-text">Elegí el plan que mejor se adapte a cómo usás NutriVision AI</p>
      </div>

      {error && <p className="field-error" style={{ marginBottom: 16 }}>{error}</p>}

      {isFree && planData && (
        <div className="pricing-page__usage">
          <div>
            <p className="pricing-page__usage-title">
              Escaneos de hoy: <span className="mono-num">{planData.scansToday}</span> de{' '}
              <span className="mono-num">{planData.freeDailyScanLimit}</span>
            </p>
            <p className="helper-text" style={{ margin: 0 }}>
              {planData.scansRemaining > 0
                ? `Te quedan ${planData.scansRemaining} escaneo(s) disponibles hoy.`
                : 'Llegaste al límite diario de tu plan. Se renueva mañana.'}
            </p>
          </div>
          <div className="pricing-page__usage-track">
            <div
              className="pricing-page__usage-fill"
              style={{ width: `${Math.min((planData.scansToday / planData.freeDailyScanLimit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="pricing-page__grid">
        {/* Plan Gratuito */}
        <section className={`card pricing-card${isFree ? ' is-current' : ''}`}>
          {isFree && <span className="pricing-card__badge">Tu plan actual</span>}
          <h2>Gratuito</h2>
          <p className="pricing-card__price"><span className="mono-num">$0</span> <span className="helper-text">/ mes</span></p>
          <p className="helper-text pricing-card__tagline">Para empezar a registrar tus comidas sin complicarte.</p>

          <ul className="pricing-card__features">
            {FEATURES.map((f) => (
              <li key={f.label} className={f.free === false ? 'is-off' : ''}>
                {f.free === false ? <X size={16} /> : <Check size={16} />}
                <span>{f.label}</span>
                {typeof f.free === 'string' && <em className="pricing-card__limit">{f.free}</em>}
              </li>
            ))}
          </ul>

          {isFree ? (
            <button type="button" className="btn btn-ghost btn-block" disabled>Plan actual</button>
          ) : (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => switchPlan('FREE')} disabled={switching}>
              {switching ? 'Cambiando…' : 'Volver al plan Gratuito'}
            </button>
          )}
        </section>

        {/* Plan Premium */}
        <section className={`card pricing-card pricing-card--premium${!isFree ? ' is-current' : ''}`}>
          {!isFree && <span className="pricing-card__badge pricing-card__badge--premium">Tu plan actual</span>}
          <div className="pricing-card__premium-title">
            <Sparkles size={18} />
            <h2>Premium</h2>
          </div>
          <p className="pricing-card__price"><span className="mono-num">$4.999</span> <span className="helper-text">/ mes</span></p>
          <p className="helper-text pricing-card__tagline">Escaneos sin límite y control total de tus metas.</p>

          <ul className="pricing-card__features">
            {FEATURES.map((f) => (
              <li key={f.label}>
                <Check size={16} />
                <span>{f.label}</span>
                {typeof f.premium === 'string' && <em className="pricing-card__limit">{f.premium}</em>}
              </li>
            ))}
          </ul>

          {!isFree ? (
            <button type="button" className="btn btn-ghost btn-block" disabled>Plan actual</button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={() => switchPlan('PREMIUM')} disabled={switching}>
              {switching ? 'Cambiando…' : 'Pasarme a Premium'}
            </button>
          )}
        </section>
      </div>

      <p className="pricing-page__demo-note">
        <Info size={14} />
        El cambio de plan no procesa ningún pago: todavía no hay una pasarela de cobro integrada.
        Cambiar de plan acá solo actualiza tu cuenta para poder probar las diferencias entre ambos.
      </p>

      <style>{`
        .pricing-page { padding: 32px 24px 64px; max-width: 900px; }
        .pricing-page__header { margin-bottom: 22px; }
        .pricing-page__header h1 { margin: 0 0 2px; }

        .pricing-page__usage {
          background: var(--color-primary-soft); border: 1px solid var(--color-primary);
          border-radius: var(--radius-lg); padding: 18px 20px; margin-bottom: 20px;
        }
        .pricing-page__usage-title { margin: 0 0 2px; font-weight: 700; }
        .pricing-page__usage-track {
          height: 8px; background: rgba(255,255,255,0.7); border-radius: 999px; overflow: hidden; margin-top: 12px;
        }
        .pricing-page__usage-fill { height: 100%; background: var(--gradient-primary); border-radius: 999px; transition: width 0.4s ease; }

        .pricing-page__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 760px) { .pricing-page__grid { grid-template-columns: 1fr; } }

        .pricing-card { padding: 26px; position: relative; display: flex; flex-direction: column; }
        .pricing-card.is-current { border-color: var(--color-primary); border-width: 2px; }
        .pricing-card--premium { background: linear-gradient(180deg, var(--color-primary-soft) 0%, var(--color-surface) 32%); }
        .pricing-card__badge {
          position: absolute; top: -11px; left: 26px; background: var(--gradient-primary); color: #fff;
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
          padding: 4px 12px; border-radius: 999px;
        }
        .pricing-card h2 { margin: 0 0 4px; font-size: 1.3rem; }
        .pricing-card__premium-title { display: flex; align-items: center; gap: 8px; color: var(--color-primary); }
        .pricing-card__premium-title h2 { color: var(--color-ink); }
        .pricing-card__price { margin: 0 0 4px; font-size: 2rem; font-weight: 700; }
        .pricing-card__price .helper-text { font-size: 0.9rem; font-weight: 500; }
        .pricing-card__tagline { margin-bottom: 20px; }
        .pricing-card__features { list-style: none; padding: 0; margin: 0 0 22px; flex: 1; }
        .pricing-card__features li {
          display: flex; align-items: center; gap: 9px; padding: 7px 0; font-size: 0.9rem;
          border-bottom: 1px solid var(--color-line);
        }
        .pricing-card__features li:last-child { border-bottom: none; }
        .pricing-card__features svg { color: var(--color-primary); flex-shrink: 0; }
        .pricing-card__features li.is-off { color: var(--color-ink-soft); }
        .pricing-card__features li.is-off svg { color: var(--color-ink-soft); }
        .pricing-card__limit {
          margin-left: auto; font-style: normal; font-size: 0.78rem; font-weight: 700;
          color: var(--color-primary); white-space: nowrap;
        }

        .pricing-page__demo-note {
          display: flex; align-items: flex-start; gap: 7px; margin: 20px 0 0;
          font-size: 0.8rem; color: var(--color-ink-soft); line-height: 1.5;
        }
        .pricing-page__demo-note svg { flex-shrink: 0; margin-top: 2px; }
      `}
      </style>
    </div>
  );
}

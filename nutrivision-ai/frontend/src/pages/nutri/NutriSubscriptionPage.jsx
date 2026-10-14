import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, CreditCard, Smartphone, Ticket } from 'lucide-react';
import { Message, PageTitle, SectionHeader } from '../../components/ui';
import { useNutri } from '../../context/NutriContext';
import { fmtLongDate } from '../../utils/dates';

const shortDay = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

const BENEFITS = [
  'Aparecés en el directorio de nutricionistas',
  'Acceso a las fichas y el progreso de tus pacientes',
  'Podés ajustar objetivos y metas de tus pacientes',
  '5 códigos Premium por mes para regalar a tus pacientes',
];

/**
 * Suscripción mensual del nutricionista y códigos Premium del mes.
 * En la Web solo se consulta: activar o cancelar se hace desde la app.
 */
export default function NutriSubscriptionPage() {
  const { data, refresh } = useNutri();
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { refresh(); }, [refresh]);

  const sub = data?.subscription;
  if (!sub) return null;
  const codes = data.premiumCodes ?? [];
  const available = codes.filter((c) => !c.redeemed && !c.expired).length;

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('No se pudo copiar. Seleccioná el código y copialo a mano.');
    }
  }

  return (
    <div className="page page--narrow">
      <PageTitle title="Suscripción" subtitle="Tu plan mensual como nutricionista." />

      <section className={`nutri-sub-hero${sub.active ? '' : ' is-off'}`}>
        <span className="nutri-sub-hero__icon"><CreditCard size={24} /></span>
        <div>
          <span className="nutri-sub-hero__label">Estado</span>
          <strong>{sub.active ? 'Activa' : 'Inactiva'}</strong>
          <span>{sub.active ? `Hasta el ${fmtLongDate(sub.until)}` : 'Activala desde la app para aparecer en el directorio y ver a tus pacientes.'}</span>
        </div>
      </section>

      {/* En la Web no se puede activar ni cancelar */}
      <div className="role-app-only">
        <Smartphone size={20} />
        <div>
          <strong>La suscripción se {sub.active ? 'cancela' : 'activa'} desde la app</strong>
          <span>
            Desde la web podés ver el estado de tu suscripción y tus códigos. Para activarla o cancelarla, usá NutriVision IA en tu celular.{' '}
            <Link to="/download">Descargar la app</Link>
          </span>
        </div>
      </div>

      <section className="card">
        <SectionHeader title="Incluye" />
        <ul className="nutri-sub-benefits">
          {BENEFITS.map((b) => <li key={b}><Check size={15} strokeWidth={3} /> {b}</li>)}
        </ul>
      </section>

      {error ? <Message>{error}</Message> : null}

      {/* Códigos Premium del mes */}
      <section className="card">
        <SectionHeader title="Códigos Premium del mes" icon={<Ticket size={18} color="var(--color-accent)" />} />
        {codes.length === 0 ? (
          <p className="hint">Cuando actives tu suscripción vas a recibir 5 códigos. Cada uno le da a un paciente 1 mes de NutriVision Pro gratis.</p>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 10 }}>
              {sub.active
                ? `Te quedan ${available} de ${codes.length}. Vencen el ${fmtLongDate(codes[0].periodEnd)} y no se acumulan. Tus pacientes los canjean en la app.`
                : 'Estos códigos vencieron con tu último mes pagado.'}
            </p>
            <div className="nutri-codes">
              {codes.map((c) => {
                const usable = !c.redeemed && !c.expired;
                const status = c.redeemed ? `Usado por ${c.redeemedBy}${c.redeemedAt ? ` el ${shortDay(c.redeemedAt)}` : ''}` : c.expired ? 'Vencido' : 'Disponible';
                return (
                  <div key={c.code} className={`nutri-code-row${usable ? '' : ' is-used'}`}>
                    <div>
                      <strong>{c.code}</strong>
                      <span className={usable ? 'is-ok' : ''}>{status}</span>
                    </div>
                    {usable ? (
                      <button type="button" className="icon-btn" onClick={() => copy(c.code)} aria-label={`Copiar código ${c.code}`}>
                        {copied === c.code ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {data.payments.length ? (
        <section className="card">
          <SectionHeader title="Historial de pagos (prueba)" />
          {data.payments.map((p) => (
            <div key={p.id} className="role-row">
              <span className="role-row__label">{shortDay(p.periodStart)} → {shortDay(p.periodEnd)}</span>
              <span className="role-row__value" style={{ color: 'var(--color-ink-soft)', fontWeight: 600 }}>Sin cobro</span>
            </div>
          ))}
        </section>
      ) : null}

      <style>{`
        .nutri-sub-hero { display: flex; align-items: center; gap: 16px; background: var(--gradient-primary); color: #fff; border-radius: var(--radius-lg); padding: 20px; }
        .nutri-sub-hero.is-off { background: linear-gradient(135deg, #9AA0A8 0%, #62666D 100%); }
        .nutri-sub-hero__icon { width: 54px; height: 54px; border-radius: 50%; background: #fff; color: var(--color-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .nutri-sub-hero.is-off .nutri-sub-hero__icon { color: var(--color-ink-soft); }
        .nutri-sub-hero div { display: flex; flex-direction: column; }
        .nutri-sub-hero__label { font-size: 0.78rem; font-weight: 700; opacity: 0.85; }
        .nutri-sub-hero strong { font-size: 1.6rem; font-weight: 800; }
        .nutri-sub-hero div > span:last-child { font-size: 0.88rem; opacity: 0.92; }
        .nutri-sub-benefits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .nutri-sub-benefits li { display: flex; gap: 10px; align-items: flex-start; font-size: 0.93rem; }
        .nutri-sub-benefits svg { color: var(--color-primary); background: var(--color-primary-soft); border-radius: 50%; padding: 3px; width: 20px; height: 20px; flex-shrink: 0; }
        .nutri-codes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (max-width: 560px) { .nutri-codes { grid-template-columns: 1fr; } }
        .nutri-code-row { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--color-line); border-radius: var(--radius-md); }
        .nutri-code-row > div { flex: 1; display: flex; flex-direction: column; }
        .nutri-code-row strong { font-size: 1.05rem; letter-spacing: 2px; user-select: all; }
        .nutri-code-row span { font-size: 0.78rem; color: var(--color-ink-soft); font-weight: 600; }
        .nutri-code-row span.is-ok { color: var(--color-primary); }
        .nutri-code-row.is-used { opacity: 0.6; }
        .nutri-code-row.is-used strong { text-decoration: line-through; color: var(--color-ink-soft); }
      `}</style>
    </div>
  );
}

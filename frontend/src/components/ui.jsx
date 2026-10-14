import { AlertTriangle, Sparkles } from 'lucide-react';

/**
 * Piezas visuales compartidas — equivalentes a src/components/ui.js de la app mobile,
 * para que la Web y el celular se vean igual.
 */

export function PageTitle({ title, subtitle, right, back }) {
  return (
    <div className="page-title">
      {back}
      <div className="page-title__text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {right ? <div className="page-title__right">{right}</div> : null}
    </div>
  );
}

export function SectionHeader({ title, action, onAction, icon }) {
  return (
    <div className="section-header">
      <h3 style={icon ? { display: 'flex', alignItems: 'center', gap: 8 } : undefined}>{icon}{title}</h3>
      {action ? (
        <button type="button" className="section-header__action" onClick={onAction}>{action}</button>
      ) : null}
    </div>
  );
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {children}
    </div>
  );
}

export function Message({ tone = 'error', children, style }) {
  const cls = tone === 'success' ? ' message--success' : tone === 'warning' ? ' message--warning' : '';
  return <p className={`message${cls}`} role={tone === 'error' ? 'alert' : 'status'} style={style}>{children}</p>;
}

/** Totales de un plato: kcal + macros con su color. */
export function MacroTotals({ calories, proteinG, carbsG, fatG, white = false }) {
  const items = [
    { label: 'kcal', value: Math.round(calories || 0), color: 'var(--color-primary)' },
    { label: 'Prot', value: `${Math.round(proteinG || 0)}g`, color: 'var(--macro-protein)' },
    { label: 'Carbs', value: `${Math.round(carbsG || 0)}g`, color: 'var(--macro-carbs)' },
    { label: 'Grasas', value: `${Math.round(fatG || 0)}g`, color: 'var(--macro-fats)' },
  ];
  return (
    <div className={`macro-totals${white ? ' macro-totals--white' : ''}`}>
      {items.map((it) => (
        <div className="macro-totals__item" key={it.label}>
          <span className="macro-totals__value" style={{ color: it.color }}>{it.value}</span>
          <span className="macro-totals__label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

const ALIGNMENT = {
  ON_TRACK: { label: 'Va con tu objetivo', bg: 'var(--color-surface)', fg: 'var(--color-primary-dark)' },
  NEEDS_ADJUSTMENT: { label: 'Necesita ajustes', bg: 'var(--color-accent-soft)', fg: 'var(--color-accent-ink)' },
  OFF_TRACK: { label: 'Se aleja de tu objetivo', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
};

/** Devolución del Coach IA, con el aviso de que no reemplaza a un profesional. */
export function CoachCard({ feedback, updating = false, notes = [] }) {
  if (!feedback) return null;
  const align = ALIGNMENT[feedback.alignment];
  return (
    <>
      <p className="coach-disclaimer">
        <AlertTriangle size={13} />
        El Coach IA da sugerencias generales, no reemplaza el consejo de un nutricionista u otro profesional de la salud.
      </p>
      <section className={`coach-card${updating ? ' is-updating' : ''}`} aria-busy={updating}>
        <div className="coach-card__head">
          <span className="coach-card__icon"><Sparkles size={18} /></span>
          <span className="coach-card__title">Coach IA</span>
          {align ? (
            <span className="coach-card__pill" style={{ background: align.bg, color: align.fg }}>{align.label}</span>
          ) : null}
        </div>
        {notes.filter(Boolean).map((n) => <p className="coach-card__note" key={n}>{n}</p>)}
        <p className="coach-card__summary">{feedback.summary}</p>
        {feedback.tips?.length > 0 && (
          <ul className="coach-card__tips">
            {feedback.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        )}
      </section>
    </>
  );
}

/** Tarjeta seleccionable con ícono, título, descripción y radio (Onboarding / Perfil). */
export function OptionCard({ option, active, onSelect, compact = false }) {
  const { Icon, label, desc, subtitle } = option;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={`option-card${compact ? ' option-card--compact' : ''}${active ? ' is-active' : ''}`}
      onClick={onSelect}
    >
      {Icon ? <span className="icon-tile"><Icon size={20} /></span> : null}
      <span className="option-card__text">
        <span className="option-card__title">{label}</span>
        {desc || subtitle ? <span className="option-card__desc">{desc || subtitle}</span> : null}
      </span>
      <span className="option-card__radio" aria-hidden="true" />
    </button>
  );
}

/** Campo numérico con etiqueta y unidad. */
export function NumberField({ id, label, unit, value, onChange, ...props }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div className="number-field">
        <input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} {...props} />
        {unit ? <span className="number-field__unit">{unit}</span> : null}
      </div>
    </div>
  );
}

export function ChipGroup({ options, value, onChange, label }) {
  return (
    <div className="chip-group" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`chip${o.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Saludo según la hora, igual que en mobile. */
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

import { useState } from 'react';
import Portal from './Portal';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AtSign, ChevronRight, Link as LinkIcon, Mail, MessageCircle, Star } from 'lucide-react';

/**
 * Piezas compartidas de las interfaces de Nutricionista y Administrador
 * (equivalentes a components/Nutritionist.js y components/Admin.js de mobile).
 */

/** Botón de volver para PageTitle. */
export function BackButton({ fallback = '/' }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(fallback))}
      aria-label="Volver"
    >
      <ArrowLeft size={20} />
    </button>
  );
}

/** Foto o iniciales. */
export function Avatar({ src, name, size = 48 }) {
  const initials = String(name || '?')
    .replace(/^(lic\.?|dra?\.?)\s+/i, '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const style = { width: size, height: size, fontSize: size * 0.36 };
  if (src) return <img src={src} alt="" className="role-avatar" style={style} />;
  return <span className="role-avatar role-avatar--empty" style={style}>{initials || '?'}</span>;
}

/** Estrellas de solo lectura. */
export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="role-stars" aria-label={`${value || 0} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} color="var(--color-accent)" fill={value >= n - 0.25 ? 'var(--color-accent)' : 'transparent'} />
      ))}
    </span>
  );
}

/** Promedio + cantidad de valoraciones. */
export function RatingLine({ rating }) {
  if (!rating?.count) return <span className="role-rating">Sin valoraciones todavía</span>;
  return (
    <span className="role-rating">
      <Stars value={rating.average} />
      {String(rating.average).replace('.', ',')} ({rating.count} {rating.count === 1 ? 'valoración' : 'valoraciones'})
    </span>
  );
}

export function SpecialtyTags({ items }) {
  if (!items?.length) return null;
  return (
    <div className="role-tags">
      {items.map((s) => <span key={s} className="role-tag role-tag--green">{s}</span>)}
    </div>
  );
}

const TAG_TONES = ['green', 'gold', 'blue', 'purple', 'red', 'gray'];
/** Etiqueta chica de color. */
export function Tag({ label, tone = 'gray' }) {
  return <span className={`role-tag role-tag--${TAG_TONES.includes(tone) ? tone : 'gray'}`}>{label}</span>;
}

/** Chips para filtrar. */
export function FilterChips({ options, value, onChange }) {
  return (
    <div className="role-chips" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`role-chip${o.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Selector de una opción entre varias (rol, plan). */
export function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className={`role-segmented${disabled ? ' is-disabled' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled || o.value === value}
          className={o.value === value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Modal de confirmación. `confirm` = { title, message, confirmLabel, danger, onConfirm }.
 * Se usa con el hook useConfirm().
 */
export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (opts) => setState(opts);
  const modal = state ? (
    <Portal>
    <div className="modal-overlay" onClick={() => setState(null)}>
      <div className="modal-panel confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {state.icon ? <span className={`icon-tile${state.danger ? ' icon-tile--danger' : ''}`}>{state.icon}</span> : null}
        <h3>{state.title}</h3>
        <p>{state.message}</p>
        <div className="confirm-modal__actions">
          <button type="button" className="btn btn-ghost" onClick={() => setState(null)}>Cancelar</button>
          <button
            type="button"
            className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => { const fn = state.onConfirm; setState(null); fn(); }}
          >
            {state.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  ) : null;
  return [ask, modal];
}

// ---- Contactos del nutricionista ----
const isUrl = (v) => /^https?:\/\//i.test(v);

function contactActions(contacts) {
  if (!contacts) return [];
  const out = [];
  if (contacts.whatsapp) {
    out.push({ key: 'wa', label: 'WhatsApp', value: contacts.whatsapp, Icon: MessageCircle, color: '#16A34A', url: `https://wa.me/${contacts.whatsapp.replace(/\D/g, '')}` });
  }
  if (contacts.email) out.push({ key: 'mail', label: 'Email', value: contacts.email, Icon: Mail, color: 'var(--color-water)', url: `mailto:${contacts.email}` });
  if (contacts.instagram) {
    const handle = contacts.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '');
    out.push({ key: 'ig', label: 'Instagram', value: `@${handle}`, Icon: AtSign, color: '#DB2777', url: `https://instagram.com/${handle}` });
  }
  if (contacts.other) out.push({ key: 'other', label: 'Otro contacto', value: contacts.other, Icon: LinkIcon, color: 'var(--color-ink-soft)', url: isUrl(contacts.other) ? contacts.other : null });
  return out;
}

export function ContactList({ contacts }) {
  const actions = contactActions(contacts);
  if (!actions.length) return <p className="hint">Todavía no hay medios de contacto cargados.</p>;
  return (
    <div className="role-contacts">
      {actions.map(({ key, label, value, Icon, color, url }) => {
        const body = (
          <>
            <span className="role-contact__icon" style={{ color }}><Icon size={18} /></span>
            <span className="role-contact__text">
              <span className="role-contact__label">{label}</span>
              <span className="role-contact__value">{value}</span>
            </span>
            {url ? <ChevronRight size={16} className="menu-row__chevron" /> : null}
          </>
        );
        return url ? (
          <a key={key} href={url} target="_blank" rel="noreferrer" className="role-contact">{body}</a>
        ) : (
          <div key={key} className="role-contact">{body}</div>
        );
      })}
    </div>
  );
}

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const CHART_H = 120;

/**
 * Calorías por día (7 barras) con la meta como línea de referencia.
 * `days`: [{ date, calories }]; `selected`/`onSelect`: día elegido.
 */
export function WeekBars({ days, goal, selected, onSelect }) {
  const top = Math.max(goal || 0, ...days.map((d) => d.calories), 1) * 1.1;
  const goalY = goal ? CHART_H - (goal / top) * CHART_H : null;
  const active = days[selected];
  return (
    <div className="week-bars">
      <p className="week-bars__readout">
        <strong>{Math.round(active?.calories || 0)} kcal</strong>
        {' '}el {active ? `${active.date.getDate()}/${active.date.getMonth() + 1}` : ''}
        {goal ? ` · meta ${goal} kcal` : ''}
      </p>
      <div className="week-bars__chart" style={{ height: CHART_H }}>
        {goalY != null ? <span className="week-bars__goal" style={{ top: goalY }} /> : null}
        {days.map((d, i) => {
          const h = d.calories ? Math.max((d.calories / top) * CHART_H, 3) : 0;
          const over = goal && d.calories > goal * 1.1;
          return (
            <button
              key={d.date.toISOString()}
              type="button"
              className="week-bars__col"
              onClick={() => onSelect(i)}
              aria-label={`${Math.round(d.calories)} kilocalorías el ${d.date.getDate()}/${d.date.getMonth() + 1}`}
            >
              <span
                className={`week-bars__bar${over ? ' is-over' : ''}${i === selected ? ' is-active' : ''}`}
                style={{ height: h }}
              />
            </button>
          );
        })}
      </div>
      <div className="week-bars__labels">
        {days.map((d, i) => (
          <span key={d.date.toISOString()} className={i === selected ? 'is-active' : ''}>
            {DAY_LETTERS[d.date.getDay()]}<br />{d.date.getDate()}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Fila de dato (etiqueta · valor). */
export function InfoRow({ label, value }) {
  return (
    <div className="role-row">
      <span className="role-row__label">{label}</span>
      <span className="role-row__value">{value}</span>
    </div>
  );
}

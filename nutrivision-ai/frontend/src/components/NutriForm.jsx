import { useState } from 'react';
import { Lock, Plus, X } from 'lucide-react';

// Sugerencias para cargar especialidades con un clic (también se pueden escribir).
const SUGGESTED = [
  'Deportiva', 'Descenso de peso', 'Vegetariana y vegana', 'Clínica', 'Pediátrica',
  'Diabetes', 'Trastornos alimentarios', 'Embarazo y lactancia', 'Celiaquía',
];
const MAX_SPECIALTIES = 8;

/** Estado inicial del formulario a partir del perfil guardado. */
export function formFromProfile(profile, displayName) {
  return {
    displayName: displayName || '',
    licenseNumber: profile?.licenseNumber || '',
    bio: profile?.bio || '',
    specialties: profile?.specialties || [],
    contactWhatsapp: profile?.contactWhatsapp || '',
    contactEmail: profile?.contactEmail || '',
    contactInstagram: profile?.contactInstagram || '',
    contactOther: profile?.contactOther || '',
  };
}

/** Validación local (el backend vuelve a validar todo). */
export function validateNutriForm(form, { withLicense }) {
  if (form.displayName.trim().length < 3) return 'Escribí tu nombre profesional.';
  if (withLicense && form.licenseNumber.trim().length < 3) return 'Ingresá tu número de matrícula.';
  if (!form.specialties.length) return 'Agregá al menos una especialidad.';
  const hasContact = ['contactWhatsapp', 'contactEmail', 'contactInstagram', 'contactOther'].some((k) => form[k].trim());
  if (!hasContact) return 'Cargá al menos un medio de contacto para que tus pacientes puedan escribirte.';
  if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) return 'El correo de contacto no es válido.';
  if (form.contactWhatsapp.trim() && !/^\+?[\d\s()-]{6,24}$/.test(form.contactWhatsapp.trim())) return 'El WhatsApp tiene que ser un número de teléfono (con código de área).';
  return null;
}

/** Cuerpo para el backend. */
export function nutriFormBody(form, { withLicense }) {
  return {
    displayName: form.displayName.trim(),
    ...(withLicense && { licenseNumber: form.licenseNumber.trim() }),
    bio: form.bio.trim(),
    specialties: form.specialties,
    contactWhatsapp: form.contactWhatsapp.trim(),
    contactEmail: form.contactEmail.trim(),
    contactInstagram: form.contactInstagram.trim(),
    contactOther: form.contactOther.trim(),
  };
}

function TextInput({ id, label, ...props }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" {...props} />
    </div>
  );
}

/** Campos del perfil profesional (solicitud y edición). */
export function NutriProfileFields({ form, update, licenseEditable = true }) {
  const set = (key) => (e) => update(key, e.target.value);
  return (
    <div className="nutri-form">
      <div className="nutri-form__grid">
        <TextInput id="nf-name" label="Nombre profesional" value={form.displayName} onChange={set('displayName')} placeholder="Ej: Lic. Ana Pérez" maxLength={100} />
        {licenseEditable ? (
          <TextInput id="nf-license" label="Matrícula profesional" value={form.licenseNumber} onChange={set('licenseNumber')} placeholder="Ej: MN 12345" maxLength={30} />
        ) : (
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Matrícula profesional</span>
            <div className="nutri-form__locked"><span>{form.licenseNumber}</span><Lock size={14} /></div>
            <span className="hint">Verificada por un administrador. No se puede cambiar.</span>
          </div>
        )}
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="nf-bio">Sobre vos</label>
        <textarea
          id="nf-bio"
          className="role-textarea"
          value={form.bio}
          onChange={set('bio')}
          placeholder="Contá tu experiencia, cómo trabajás y si atendés online o presencial."
          maxLength={1000}
          rows={4}
        />
        <span className="hint">{form.bio.length}/1000</span>
      </div>

      <SpecialtiesInput value={form.specialties} onChange={(v) => update('specialties', v)} />

      <div>
        <h3 style={{ margin: 0 }}>Contacto</h3>
        <p className="hint">Lo ven solo los usuarios NutriVision Pro. Cargá al menos uno: el contacto con tus pacientes es por fuera de la app.</p>
      </div>
      <div className="nutri-form__grid">
        <TextInput id="nf-wa" label="WhatsApp" value={form.contactWhatsapp} onChange={set('contactWhatsapp')} placeholder="+54 9 11 1234-5678" type="tel" maxLength={24} />
        <TextInput id="nf-mail" label="Correo de contacto" value={form.contactEmail} onChange={set('contactEmail')} placeholder="consultas@ejemplo.com" type="email" maxLength={120} />
        <TextInput id="nf-ig" label="Instagram" value={form.contactInstagram} onChange={set('contactInstagram')} placeholder="@tu.usuario" maxLength={60} />
        <TextInput id="nf-other" label="Otro (web, consultorio, etc.)" value={form.contactOther} onChange={set('contactOther')} placeholder="https://… o dirección del consultorio" maxLength={200} />
      </div>

      <style>{`
        .nutri-form { display: flex; flex-direction: column; gap: 16px; }
        .nutri-form__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 640px) { .nutri-form__grid { grid-template-columns: 1fr; } }
        .nutri-form__locked {
          display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--color-bg);
          border: 1.5px solid var(--color-line); border-radius: var(--radius-md); padding: 11px 14px; font-weight: 700;
        }
        .nutri-form__locked svg { color: var(--color-ink-muted); }
        .nutri-spec__chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .nutri-spec__on {
          display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; border: none;
          background: var(--color-primary); color: #fff; font-weight: 700; font-size: 0.85rem; cursor: pointer;
        }
        .nutri-spec__sug {
          display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 999px;
          border: 1px solid var(--color-line); background: var(--color-surface); color: var(--color-ink-soft);
          font-weight: 700; font-size: 0.8rem; cursor: pointer;
        }
        .nutri-spec__sug:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .nutri-spec__add { display: flex; gap: 8px; }
        .nutri-spec__add input { flex: 1; min-width: 0; }
      `}</style>
    </div>
  );
}

function SpecialtiesInput({ value, onChange }) {
  const [text, setText] = useState('');
  const full = value.length >= MAX_SPECIALTIES;
  const add = (raw) => {
    const s = raw.trim();
    if (s.length < 2 || full || value.some((v) => v.toLowerCase() === s.toLowerCase())) return;
    onChange([...value, s.slice(0, 40)]);
    setText('');
  };
  const suggestions = SUGGESTED.filter((s) => !value.includes(s));

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <span className="field-label">Especialidades</span>
      {value.length ? (
        <div className="nutri-spec__chips">
          {value.map((s) => (
            <button key={s} type="button" className="nutri-spec__on" onClick={() => onChange(value.filter((v) => v !== s))} aria-label={`Quitar ${s}`}>
              {s} <X size={13} />
            </button>
          ))}
        </div>
      ) : null}
      {!full ? (
        <div className="nutri-spec__add">
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text); } }}
            placeholder="Escribí una especialidad y apretá Enter"
            maxLength={40}
          />
          <button type="button" className="btn btn-primary" onClick={() => add(text)} disabled={text.trim().length < 2} aria-label="Agregar especialidad">
            <Plus size={18} />
          </button>
        </div>
      ) : (
        <span className="hint">Máximo {MAX_SPECIALTIES} especialidades.</span>
      )}
      {!full && suggestions.length ? (
        <div className="nutri-spec__chips">
          {suggestions.map((s) => (
            <button key={s} type="button" className="nutri-spec__sug" onClick={() => add(s)}>
              <Plus size={12} /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

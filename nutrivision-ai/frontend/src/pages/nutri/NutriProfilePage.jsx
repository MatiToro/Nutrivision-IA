import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, Eye, EyeOff, Pencil, Users } from 'lucide-react';
import apiClient from '../../api/client';
import { ContactList, RatingLine, SpecialtyTags, Stars } from '../../components/roles';
import { NutriProfileFields, formFromProfile, nutriFormBody, validateNutriForm } from '../../components/NutriForm';
import { Message, PageTitle, SectionHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useNutri } from '../../context/NutriContext';
import { fmtDate } from '../../utils/dates';

/** Perfil profesional público del nutricionista: datos, contactos y valoraciones recibidas. */
export default function NutriProfilePage() {
  const { profile: user, setProfile } = useAuth();
  const { data, apply, refresh } = useNutri();
  const photoRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await apiClient.get('/nutritionist/me/reviews');
        setReviews(res.reviews);
      } catch {
        setReviews([]);
      }
    })();
  }, []);

  const profile = data?.profile;
  const listed = data?.subscription?.active;
  if (!profile) return null;

  const update = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setError(null); };
  const startEdit = () => {
    setForm(formFromProfile(profile, user?.displayName));
    setEditing(true);
    setSuccess(null);
    setError(null);
  };

  async function save() {
    const problem = validateNutriForm(form, { withLicense: false });
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      const { data: res } = await apiClient.patch('/nutritionist/me/profile', nutriFormBody(form, { withLicense: false }));
      apply(res);
      setEditing(false);
      setSuccess('Perfil actualizado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const { data: res } = await apiClient.patch('/users/me/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(res.user);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const name = user?.displayName || 'Tu perfil';
  const initials = name.replace(/^(lic\.?|dra?\.?)\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const contacts = { whatsapp: profile.contactWhatsapp, email: profile.contactEmail, instagram: profile.contactInstagram, other: profile.contactOther };

  return (
    <div className="page">
      <PageTitle
        title="Mi perfil"
        subtitle="Así te ven los usuarios en el directorio."
        right={editing ? (
          <>
            <button type="button" className="pill-btn pill-btn--outline" onClick={() => { setEditing(false); setError(null); }} disabled={saving}>Cancelar</button>
            <button type="button" className="pill-btn pill-btn--solid" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        ) : (
          <button type="button" className="pill-btn pill-btn--soft" onClick={startEdit}><Pencil size={14} /> Editar</button>
        )}
      />

      <section className="nutri-hero">
        <div className="nutri-hero__avatar-wrap">
          <div className="nutri-hero__avatar">
            {uploading ? <span className="nutri-hero__spinner" /> : user?.photoUrl ? <img src={user.photoUrl} alt="Tu foto" /> : <span>{initials}</span>}
          </div>
          <button type="button" className="nutri-hero__camera" onClick={() => photoRef.current?.click()} disabled={uploading} aria-label="Cambiar foto">
            <Camera size={14} />
          </button>
          <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handlePhoto} />
        </div>
        <div className="nutri-hero__info">
          <h2>{name} <BadgeCheck size={18} /></h2>
          <p>Matrícula {profile.licenseNumber}</p>
          <div className="nutri-hero__badges">
            <span className="badge badge--light">{listed ? <Eye size={11} /> : <EyeOff size={11} />} {listed ? 'Visible en el directorio' : 'Oculto del directorio'}</span>
            <span className="badge badge--light"><Users size={11} /> {data.stats.activePatients} {data.stats.activePatients === 1 ? 'paciente' : 'pacientes'}</span>
          </div>
        </div>
      </section>

      {success ? <Message tone="success">{success}</Message> : null}
      {error ? <Message>{error}</Message> : null}

      {editing ? (
        <>
          <section className="card"><NutriProfileFields form={form} update={update} licenseEditable={false} /></section>
          <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </>
      ) : (
        <div className="grid-2">
          <div className="nutri-col">
            <section className="card">
              <SectionHeader title="Valoración" />
              <RatingLine rating={data.stats.rating} />
            </section>
            <section className="card">
              <SectionHeader title="Sobre mí" />
              <p className="nutri-bio">{profile.bio || 'Todavía no escribiste tu descripción.'}</p>
              <SpecialtyTags items={profile.specialties} />
            </section>
            <section className="card">
              <SectionHeader title="Contacto" />
              <p className="hint" style={{ marginBottom: 10 }}>Lo ven solo los usuarios NutriVision Pro.</p>
              <ContactList contacts={contacts} />
            </section>
          </div>
          <section className="card">
            <SectionHeader title={`Valoraciones recibidas${reviews?.length ? ` (${reviews.length})` : ''}`} />
            {reviews === null ? <p className="hint">Cargando…</p> : reviews.length === 0 ? (
              <p className="hint">Todavía no recibiste valoraciones. Las dejan tus pacientes actuales o anteriores desde la app.</p>
            ) : reviews.map((r) => (
              <div key={r.id} className="nutri-review">
                <div className="nutri-review__top"><strong>{r.author}</strong><span>{fmtDate(r.updatedAt)}</span></div>
                <Stars value={r.stars} size={13} />
                {r.comment ? <p>{r.comment}</p> : null}
              </div>
            ))}
          </section>
        </div>
      )}

      <style>{`
        .nutri-hero { display: flex; align-items: center; gap: 16px; background: var(--gradient-primary); color: #fff; border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-card); }
        .nutri-hero__avatar-wrap { position: relative; flex-shrink: 0; }
        .nutri-hero__avatar {
          width: 76px; height: 76px; border-radius: 50%; background: #fff; overflow: hidden; border: 3px solid rgba(255,255,255,0.6);
          display: flex; align-items: center; justify-content: center; color: var(--color-primary); font-size: 1.6rem; font-weight: 800;
        }
        .nutri-hero__avatar img { width: 100%; height: 100%; object-fit: cover; }
        .nutri-hero__spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--color-primary-soft); border-top-color: var(--color-primary); animation: spin 0.9s linear infinite; }
        .nutri-hero__camera {
          position: absolute; right: -2px; bottom: -2px; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff;
          background: var(--color-primary-dark); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .nutri-hero__info { flex: 1; min-width: 0; }
        .nutri-hero__info h2 { margin: 0; color: #fff; display: flex; align-items: center; gap: 6px; }
        .nutri-hero__info p { margin: 2px 0 0; opacity: 0.9; font-size: 0.9rem; }
        .nutri-hero__badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .nutri-col { display: flex; flex-direction: column; gap: 20px; }
        @media (max-width: 960px) { .nutri-col { gap: 16px; } }
        .nutri-bio { margin: 0 0 10px; line-height: 1.55; white-space: pre-line; }
        .nutri-review { display: flex; flex-direction: column; gap: 4px; padding: 11px 0; border-bottom: 1px solid var(--color-line); }
        .nutri-review:last-child { border-bottom: none; }
        .nutri-review__top { display: flex; justify-content: space-between; gap: 8px; }
        .nutri-review__top span { font-size: 0.8rem; color: var(--color-ink-muted); }
        .nutri-review p { margin: 0; font-size: 0.92rem; line-height: 1.5; }
      `}</style>
    </div>
  );
}

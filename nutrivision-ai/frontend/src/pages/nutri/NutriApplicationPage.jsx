import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Send } from 'lucide-react';
import apiClient from '../../api/client';
import LoadingScreen from '../../components/LoadingScreen';
import { BackButton, useConfirm } from '../../components/roles';
import { NutriProfileFields, formFromProfile, nutriFormBody, validateNutriForm } from '../../components/NutriForm';
import { Message, PageTitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useNutri } from '../../context/NutriContext';

/**
 * Solicitud de alta como nutricionista: matrícula, descripción,
 * especialidades y contactos. Queda "En revisión" hasta que un Administrador
 * la apruebe. También sirve para corregir y reenviar una solicitud rechazada.
 */
export default function NutriApplicationPage() {
  const { data, loading } = useNutri();
  if (loading) return <LoadingScreen label="Cargando…" />;
  return <ApplicationForm key={data?.profile?.id || 'new'} />;
}

function ApplicationForm() {
  const navigate = useNavigate();
  const { profile: user, changeRole } = useAuth();
  const { data, apply } = useNutri();
  const current = data?.profile;
  const [form, setForm] = useState(() => formFromProfile(current, user?.displayName));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ask, confirmModal] = useConfirm();

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  if (current?.status === 'APPROVED') {
    return (
      <div className="page page--narrow">
        <PageTitle title="Solicitud profesional" back={<BackButton fallback="/nutri" />} />
        <Message tone="success">Tu cuenta ya está aprobada. Editá tus datos desde "Mi perfil".</Message>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    const problem = validateNutriForm(form, { withLicense: true });
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const { data: res } = await apiClient.put('/nutritionist/me/application', nutriFormBody(form, { withLicense: true }));
      apply(res);
      navigate('/nutri', { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const notNutri = () => ask({
    title: 'Usar la cuenta como paciente',
    message: 'Esta cuenta pasa a ser de usuario (paciente) y se descarta la solicitud de nutricionista.',
    confirmLabel: 'Soy usuario',
    onConfirm: async () => {
      try {
        await changeRole('USER');
        navigate('/', { replace: true });
      } catch (err) {
        setError(err.message);
      }
    },
  });

  return (
    <form className="page page--narrow" onSubmit={submit} noValidate>
      <PageTitle
        title={current ? 'Editar solicitud' : 'Solicitud profesional'}
        subtitle="Tus datos como nutricionista"
        back={<BackButton fallback="/nutri" />}
      />

      <section className="card card--soft nutri-app__intro">
        <BadgeCheck size={22} color="var(--color-primary)" />
        <p>
          Completá tus datos profesionales. Un administrador verifica tu matrícula y, cuando te apruebe, vas a poder
          activar tu suscripción desde la app y aparecer en el directorio.
        </p>
      </section>

      {current?.status === 'REJECTED' && current.rejectionReason ? (
        <Message>Motivo del rechazo: {current.rejectionReason}</Message>
      ) : null}

      <section className="card">
        <NutriProfileFields form={form} update={update} />
      </section>

      {error ? <Message>{error}</Message> : null}
      <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
        {saving ? 'Enviando…' : current ? 'Reenviar solicitud' : 'Enviar solicitud'} {!saving && <Send size={17} />}
      </button>

      <button type="button" className="nutri-app__switch" onClick={notNutri}>
        No soy nutricionista: quiero usar la cuenta como paciente
      </button>

      {confirmModal}
      <style>{`
        .nutri-app__intro { display: flex; gap: 12px; align-items: flex-start; }
        .nutri-app__intro svg { flex-shrink: 0; margin-top: 2px; }
        .nutri-app__intro p { margin: 0; font-size: 0.9rem; line-height: 1.5; }
        .nutri-app__switch {
          align-self: center; background: none; border: none; color: var(--color-ink-soft);
          font-weight: 700; font-size: 0.85rem; text-decoration: underline; cursor: pointer;
        }
      `}</style>
    </form>
  );
}

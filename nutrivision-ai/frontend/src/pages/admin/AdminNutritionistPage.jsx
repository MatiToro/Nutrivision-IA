import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleCheck, CircleX, UserRound } from 'lucide-react';
import apiClient from '../../api/client';
import LoadingScreen from '../../components/LoadingScreen';
import { Avatar, BackButton, ContactList, InfoRow, RatingLine, SpecialtyTags, Tag, useConfirm } from '../../components/roles';
import { Message, PageTitle, SectionHeader } from '../../components/ui';
import { fmtDate } from '../../utils/dates';
import { NUTRI_STATUS_LABELS, statusTone } from './adminLabels';

/** Revisión de una solicitud de nutricionista: aprobar o rechazar con motivo. */
export default function AdminNutritionistPage() {
  const { id } = useParams();
  const [n, setN] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [ask, confirmModal] = useConfirm();

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/admin/nutritionists/${id}`);
      setN(data.nutritionist);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(path, body, okMsg) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await apiClient.post(`/admin/nutritionists/${id}/${path}`, body);
      setN(data.nutritionist);
      setSuccess(okMsg);
      setRejecting(false);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const approve = () => ask({
    title: 'Aprobar nutricionista',
    message: `Verificaste la matrícula ${n.licenseNumber}. ${n.name} va a poder activar su suscripción, aparecer en el directorio y vincular pacientes.`,
    confirmLabel: 'Aprobar',
    icon: <CircleCheck size={26} />,
    onConfirm: () => act('approve', undefined, 'Nutricionista aprobado.'),
  });

  const reject = () => {
    if (reason.trim().length < 5) {
      setError('Escribí el motivo del rechazo (al menos 5 caracteres). El nutricionista lo va a ver.');
      return;
    }
    const revoking = n.status === 'APPROVED';
    ask({
      title: revoking ? 'Revocar aprobación' : 'Rechazar solicitud',
      message: revoking
        ? 'Deja de aparecer en el directorio y pierde acceso a las fichas de sus pacientes. Puede corregir y volver a enviar la solicitud.'
        : 'El nutricionista va a ver el motivo y va a poder corregir y reenviar su solicitud.',
      confirmLabel: revoking ? 'Revocar' : 'Rechazar',
      danger: true,
      icon: <CircleX size={26} />,
      onConfirm: () => act('reject', { reason: reason.trim() }, revoking ? 'Aprobación revocada.' : 'Solicitud rechazada.'),
    });
  };

  if (!n && !error) return <LoadingScreen label="Cargando la solicitud…" />;

  return (
    <div className="page page--narrow">
      <PageTitle title="Nutricionista" back={<BackButton fallback="/admin/nutricionistas" />} />
      {error ? <Message>{error}</Message> : null}
      {success ? <Message tone="success">{success}</Message> : null}

      {n ? (
        <>
          <section className="card admin-nutri-hero">
            <Avatar src={n.photoUrl} name={n.name} size={72} />
            <h2>{n.name}</h2>
            <span>{n.email}</span>
            <div className="role-tags" style={{ justifyContent: 'center' }}>
              <Tag label={NUTRI_STATUS_LABELS[n.status]} tone={statusTone(n.status)} />
              {n.status === 'APPROVED' ? <Tag label={n.subscriptionActive ? 'Suscripción activa' : 'Sin suscripción'} tone={n.subscriptionActive ? 'green' : 'gray'} /> : null}
              {n.banned ? <Tag label="Baneado" tone="red" /> : null}
            </div>
          </section>

          {/* Lo que hay que verificar */}
          <section className="card admin-license">
            <span className="admin-license__label">Matrícula declarada</span>
            <strong>{n.licenseNumber}</strong>
            <span className="hint">Verificala en el registro oficial de matrículas antes de aprobar.</span>
          </section>

          <section className="card">
            <SectionHeader title="Solicitud" />
            <InfoRow label="Enviada / actualizada" value={fmtDate(n.updatedAt)} />
            <InfoRow label="Primera solicitud" value={fmtDate(n.createdAt)} />
            {n.reviewedAt ? <InfoRow label="Última revisión" value={`${fmtDate(n.reviewedAt)}${n.reviewedBy ? ` · ${n.reviewedBy}` : ''}`} /> : null}
            {n.status === 'REJECTED' && n.rejectionReason ? <InfoRow label="Motivo del rechazo" value={n.rejectionReason} /> : null}
            {n.status === 'APPROVED' ? (
              <>
                <InfoRow label="Pacientes activos" value={String(n.activePatients)} />
                <InfoRow label="Suscripción" value={n.subscriptionActive ? `hasta el ${fmtDate(n.subscriptionUntil)}` : 'Inactiva'} />
              </>
            ) : null}
          </section>

          <section className="card">
            <SectionHeader title="Perfil profesional" />
            <p style={{ margin: '0 0 10px', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{n.bio || 'Sin descripción.'}</p>
            <SpecialtyTags items={n.specialties} />
            {n.status === 'APPROVED' ? <div style={{ marginTop: 10 }}><RatingLine rating={n.rating} /></div> : null}
          </section>

          <section className="card">
            <SectionHeader title="Contacto" />
            <ContactList contacts={n.contacts} />
          </section>

          {/* Acciones */}
          {n.status !== 'APPROVED' ? (
            <button type="button" className="btn btn-primary btn-block" onClick={approve} disabled={busy}>
              <CircleCheck size={18} /> {busy ? 'Guardando…' : 'Aprobar'}
            </button>
          ) : null}

          {n.status !== 'REJECTED' ? (
            rejecting ? (
              <section className="card admin-reject">
                <h3>{n.status === 'APPROVED' ? 'Motivo para revocar' : 'Motivo del rechazo'}</h3>
                <textarea
                  className="role-textarea"
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setError(null); }}
                  placeholder="Ej: la matrícula no figura en el registro oficial."
                  maxLength={300}
                  autoFocus
                />
                <span className="hint">El nutricionista va a ver este motivo en su cuenta.</span>
                <div className="admin-reject__actions">
                  <button type="button" className="btn btn-ghost" onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}>Cancelar</button>
                  <button type="button" className="btn btn-danger" onClick={reject} disabled={busy}>{n.status === 'APPROVED' ? 'Revocar' : 'Rechazar'}</button>
                </div>
              </section>
            ) : (
              <button type="button" className="role-danger-btn" onClick={() => setRejecting(true)}>
                <CircleX size={18} /> {n.status === 'APPROVED' ? 'Revocar aprobación' : 'Rechazar solicitud'}
              </button>
            )
          ) : null}

          <Link to={`/admin/usuarios/${n.userId}`} className="admin-account-link">
            <UserRound size={15} /> Ver cuenta (rol, baneo)
          </Link>
        </>
      ) : null}

      {confirmModal}
      <style>{`
        .admin-nutri-hero { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 24px; }
        .admin-nutri-hero h2 { margin: 4px 0 0; }
        .admin-nutri-hero > span { font-size: 0.88rem; color: var(--color-ink-soft); }
        .admin-license { display: flex; flex-direction: column; gap: 4px; background: var(--color-accent-soft); box-shadow: none; }
        .admin-license__label { font-size: 0.75rem; font-weight: 800; color: var(--color-accent-ink); text-transform: uppercase; letter-spacing: 0.05em; }
        .admin-license strong { font-size: 1.6rem; letter-spacing: 1px; user-select: all; }
        .admin-reject { display: flex; flex-direction: column; gap: 10px; }
        .admin-reject h3 { margin: 0; }
        .admin-reject__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .admin-account-link { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; font-size: 0.88rem; text-decoration: none; }
      `}</style>
    </div>
  );
}

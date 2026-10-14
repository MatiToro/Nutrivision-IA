import { Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, Clock3, RefreshCw, XCircle } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import { InfoRow } from '../../components/roles';
import { Message } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useNutri } from '../../context/NutriContext';

/**
 * Cuenta de nutricionista: mientras la solicitud no está aprobada se muestra su
 * estado (sin enviar / en revisión / rechazada); aprobada → las pantallas del panel.
 */
export default function NutriGate() {
  const { data, loading } = useNutri();
  if (loading) return <LoadingScreen label="Cargando tu cuenta…" />;
  if (!data?.profile || data.profile.status !== 'APPROVED') return <NutriStatus />;
  return <Outlet />;
}

function NutriStatus() {
  const navigate = useNavigate();
  const { profile: user } = useAuth();
  const { data, refresh, error } = useNutri();
  const profile = data?.profile;
  const firstName = (user?.displayName || '').replace(/^(lic\.?|dra?\.?)\s+/i, '').split(' ')[0];

  let icon;
  let tone = '';
  let title;
  let text;
  let action;
  if (!data && error) {
    icon = <RefreshCw size={30} />;
    tone = ' icon-tile--danger';
    title = 'Sin conexión con el servidor';
    text = error;
    action = <button type="button" className="btn btn-primary" onClick={refresh}>Reintentar</button>;
  } else if (!profile) {
    icon = <ClipboardList size={30} />;
    title = `¡Hola${firstName ? `, ${firstName}` : ''}!`;
    text = 'Para empezar a trabajar con pacientes en NutriVision, completá tu solicitud profesional con tu matrícula.';
    action = <button type="button" className="btn btn-primary" onClick={() => navigate('/nutri/solicitud')}>Completar solicitud</button>;
  } else if (profile.status === 'REJECTED') {
    icon = <XCircle size={30} />;
    tone = ' icon-tile--danger';
    title = 'Tu solicitud fue rechazada';
    text = 'Podés corregir tus datos y volver a enviarla.';
    action = <button type="button" className="btn btn-primary" onClick={() => navigate('/nutri/solicitud')}>Corregir y reenviar</button>;
  } else {
    icon = <Clock3 size={30} />;
    tone = ' icon-tile--accent';
    title = 'Solicitud en revisión';
    text = 'Un administrador está verificando tu matrícula. Cuando te apruebe vas a poder activar tu suscripción desde la app y ver a tus pacientes.';
    action = <button type="button" className="btn btn-ghost" onClick={() => navigate('/nutri/solicitud')}>Editar solicitud</button>;
  }

  return (
    <div className="page page--narrow">
      <section className="card nutri-status">
        <span className={`icon-tile${tone}`}>{icon}</span>
        <h2>{title}</h2>
        <p>{text}</p>
        {profile?.status === 'REJECTED' && profile.rejectionReason ? (
          <Message style={{ alignSelf: 'stretch' }}>Motivo: {profile.rejectionReason}</Message>
        ) : null}
        <div className="nutri-status__action">{action}</div>
      </section>

      {profile ? (
        <section className="card">
          <h3 style={{ margin: '0 0 6px' }}>Datos enviados</h3>
          <InfoRow label="Nombre" value={user?.displayName} />
          <InfoRow label="Matrícula" value={profile.licenseNumber} />
          <InfoRow label="Especialidades" value={profile.specialties.join(', ') || '—'} />
          <InfoRow label="Enviada" value={new Date(profile.createdAt).toLocaleDateString('es-AR')} />
        </section>
      ) : null}

      <button type="button" className="pill-btn pill-btn--soft" style={{ alignSelf: 'center' }} onClick={refresh}>
        <RefreshCw size={14} /> Actualizar estado
      </button>

      <style>{`
        .nutri-status { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 32px 24px; }
        .nutri-status .icon-tile { width: 72px; height: 72px; border-radius: 50%; margin-bottom: 6px; }
        .nutri-status h2 { margin: 0; }
        .nutri-status p { margin: 0; color: var(--color-ink-soft); max-width: 460px; }
        .nutri-status__action { margin-top: 10px; }
      `}</style>
    </div>
  );
}

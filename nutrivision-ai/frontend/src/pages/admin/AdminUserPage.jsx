import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, ChevronRight, ShieldCheck, UserCheck, Users } from 'lucide-react';
import apiClient from '../../api/client';
import LoadingScreen from '../../components/LoadingScreen';
import { Avatar, BackButton, InfoRow, Segmented, Tag, useConfirm } from '../../components/roles';
import { Message, PageTitle, SectionHeader } from '../../components/ui';
import { GOAL_OPTIONS, findOption } from '../../constants/profile';
import { fmtDate } from '../../utils/dates';
import { NUTRI_STATUS_LABELS, ROLE_LABELS, roleTone, statusTone } from './adminLabels';

const ROLE_OPTIONS = [
  { value: 'USER', label: 'Usuario' },
  { value: 'NUTRITIONIST', label: 'Nutricionista' },
  { value: 'ADMIN', label: 'Admin' },
];
const PLAN_OPTIONS = [
  { value: 'FREE', label: 'Gratuito' },
  { value: 'PREMIUM', label: 'NutriVision Pro' },
];
const ROLE_EFFECTS = {
  USER: 'Va a usar NutriVision como paciente (escáner, historial, nutricionistas).',
  NUTRITIONIST: 'Va a usar la interfaz de nutricionista. Si no tiene solicitud, se le va a pedir que la complete.',
  ADMIN: 'Va a tener acceso completo a este panel de administración.',
};

/** Detalle de un usuario: cambiar rol o plan, banear o desbanear. */
export default function AdminUserPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, confirmModal] = useConfirm();

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/admin/users/${id}`);
      setUser(data.user);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function patch(body, okMsg) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await apiClient.patch(`/admin/users/${id}`, body);
      setUser(data.user);
      setSuccess(okMsg);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const changeRole = (role) => ask({
    title: `Cambiar rol a ${ROLE_LABELS[role]}`,
    message: `${ROLE_EFFECTS[role]}${user.role === 'USER' && user.nutritionist ? ' Su vínculo con su nutricionista se va a terminar.' : ''}`,
    confirmLabel: 'Cambiar rol',
    icon: <Users size={26} />,
    onConfirm: () => patch({ role }, `Ahora es ${ROLE_LABELS[role]}.`),
  });

  const changePlan = (plan) => ask({
    title: plan === 'PREMIUM' ? 'Dar NutriVision Pro' : 'Pasar a Gratuito',
    message: plan === 'PREMIUM'
      ? 'Se activa el plan Pro (modo de prueba, sin cobro).'
      : `Vuelve al plan Gratuito.${user.premiumUntil ? ' El Pro por código sigue vigente hasta que venza.' : ''}`,
    confirmLabel: 'Confirmar',
    onConfirm: () => patch({ plan }, plan === 'PREMIUM' ? 'Plan Pro activado.' : 'Plan cambiado a Gratuito.'),
  });

  const toggleBan = () => ask({
    title: user.banned ? 'Desbanear cuenta' : 'Banear cuenta',
    message: user.banned
      ? 'La cuenta vuelve a poder usar NutriVision.'
      : 'La cuenta no va a poder usar la app ni la web hasta que la desbanees. Si es nutricionista, deja de aparecer en el directorio.',
    confirmLabel: user.banned ? 'Desbanear' : 'Banear',
    danger: !user.banned,
    icon: user.banned ? <UserCheck size={26} /> : <Ban size={26} />,
    onConfirm: () => patch({ banned: !user.banned }, user.banned ? 'Cuenta desbaneada.' : 'Cuenta baneada.'),
  });

  if (!user && !error) return <LoadingScreen label="Cargando el usuario…" />;
  const goal = findOption(GOAL_OPTIONS, user?.goal);
  const np = user?.nutritionistProfile;

  return (
    <div className="page page--narrow">
      <PageTitle title="Usuario" back={<BackButton fallback="/admin/usuarios" />} />
      {error ? <Message>{error}</Message> : null}
      {success ? <Message tone="success">{success}</Message> : null}

      {user ? (
        <>
          <section className={`card admin-user-hero${user.banned ? ' is-banned' : ''}`}>
            <Avatar src={user.photoUrl} name={user.name} size={64} />
            <div className="admin-user-hero__text">
              <h2>{user.name}</h2>
              <span>{user.email}</span>
              <div className="role-tags">
                <Tag label={ROLE_LABELS[user.role]} tone={roleTone(user.role)} />
                {user.role === 'USER' ? <Tag label={user.isPremium ? 'Pro' : 'Gratuito'} tone={user.isPremium ? 'gold' : 'gray'} /> : null}
                {user.banned ? <Tag label="Baneado" tone="red" /> : null}
                {user.isSelf ? <Tag label="Vos" tone="green" /> : null}
              </div>
            </div>
          </section>

          <section className="card">
            <SectionHeader title="Datos" />
            <InfoRow label="Alta" value={fmtDate(user.createdAt)} />
            <InfoRow label="Inicio de sesión" value={user.provider === 'GOOGLE' ? 'Google' : 'Correo y contraseña'} />
            {user.role === 'USER' ? (
              <>
                <InfoRow label="Edad" value={user.age ? `${user.age} años` : '—'} />
                <InfoRow label="Objetivo" value={goal?.label || (user.onboardingCompleted ? '—' : 'Todavía no completó sus datos')} />
                <InfoRow label="Platos registrados" value={String(user.mealsCount)} />
                <InfoRow label="Último plato" value={fmtDate(user.lastMealAt)} />
                <InfoRow label="Nutricionista" value={user.nutritionist?.name || 'Sin vínculo'} />
                {user.premiumUntil ? <InfoRow label="Pro por código" value={`hasta el ${fmtDate(user.premiumUntil)}`} /> : null}
              </>
            ) : null}
          </section>

          {np ? (
            <Link to={`/admin/nutricionistas/${np.id}`} className="card admin-user-np">
              <div className="admin-user-np__head"><h3>Perfil de nutricionista</h3><ChevronRight size={18} className="menu-row__chevron" /></div>
              <div className="role-tags">
                <Tag label={NUTRI_STATUS_LABELS[np.status]} tone={statusTone(np.status)} />
                <Tag label={np.subscriptionActive ? 'Suscripción activa' : 'Sin suscripción'} tone={np.subscriptionActive ? 'green' : 'gray'} />
              </div>
              <span className="hint">Matrícula {np.licenseNumber} · {np.activePatients} {np.activePatients === 1 ? 'paciente' : 'pacientes'}</span>
            </Link>
          ) : null}

          <section className="card admin-user-actions">
            <SectionHeader title="Rol" />
            <Segmented options={ROLE_OPTIONS} value={user.role} onChange={changeRole} disabled={busy || user.isSelf} />
            {user.isSelf ? <p className="hint">No podés cambiar tu propio rol.</p> : null}
          </section>

          {user.role === 'USER' ? (
            <section className="card admin-user-actions">
              <SectionHeader title="Plan" />
              <Segmented options={PLAN_OPTIONS} value={user.plan} onChange={changePlan} disabled={busy} />
              <p className="hint">Modo de prueba: cambiar el plan no genera ningún cobro.</p>
            </section>
          ) : null}

          {!user.isSelf ? (
            <button type="button" className={user.banned ? 'role-ok-btn' : 'role-danger-btn'} onClick={toggleBan} disabled={busy}>
              {user.banned ? <UserCheck size={18} /> : <Ban size={18} />} {user.banned ? 'Desbanear cuenta' : 'Banear cuenta'}
            </button>
          ) : (
            <p className="hint admin-user-self"><ShieldCheck size={15} /> Esta es tu cuenta de administrador.</p>
          )}
        </>
      ) : null}

      {confirmModal}
      <style>{`
        .admin-user-hero { display: flex; align-items: center; gap: 16px; }
        .admin-user-hero.is-banned { background: #FDF3F2; }
        .admin-user-hero__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .admin-user-hero__text h2 { margin: 0; }
        .admin-user-hero__text > span { font-size: 0.88rem; color: var(--color-ink-soft); overflow-wrap: anywhere; }
        .admin-user-np { display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: var(--color-ink); }
        .admin-user-np__head { display: flex; align-items: center; justify-content: space-between; }
        .admin-user-np__head h3 { margin: 0; font-size: 1rem; }
        .admin-user-actions { display: flex; flex-direction: column; gap: 10px; }
        .admin-user-actions .section-header { margin-bottom: 0; }
        .admin-user-self { display: flex; align-items: center; justify-content: center; gap: 6px; }
      `}</style>
    </div>
  );
}

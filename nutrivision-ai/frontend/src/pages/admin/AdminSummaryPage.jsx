import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, ChevronRight, ClipboardList, Crown, Link2, ShieldCheck, Stethoscope, UserRound, Utensils } from 'lucide-react';
import apiClient from '../../api/client';
import LoadingScreen from '../../components/LoadingScreen';
import { Message, PageTitle, SectionHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

/** Resumen del panel de Administrador: números reales de la base. */
export default function AdminSummaryPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get('/admin/stats');
        setStats(data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  if (!stats && !error) return <LoadingScreen label="Cargando el resumen…" />;
  const pending = stats?.nutritionists.pending ?? 0;

  return (
    <div className="page">
      <PageTitle title="Administración" subtitle={profile?.email} />
      {error ? <Message>{error}</Message> : null}

      {stats ? (
        <>
          <Link to="/admin/nutricionistas" className={`card admin-pending${pending > 0 ? ' is-on' : ''}`}>
            <span className={`icon-tile${pending > 0 ? ' icon-tile--accent' : ''}`}><ClipboardList size={22} /></span>
            <span className="admin-pending__text">
              <strong>{pending > 0 ? `${pending} ${pending === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}` : 'Sin solicitudes pendientes'}</strong>
              <span>Nutricionistas esperando la verificación de su matrícula.</span>
            </span>
            <ChevronRight size={18} className="menu-row__chevron" />
          </Link>

          <section>
            <SectionHeader title="Cuentas" />
            <div className="role-stat-grid">
              <Stat Icon={UserRound} tone="icon-tile--water" label="Usuarios" value={stats.users.USER} />
              <Stat Icon={Stethoscope} tone="icon-tile--violet" label="Nutricionistas" value={stats.users.NUTRITIONIST} />
              <Stat Icon={ShieldCheck} tone="" label="Administradores" value={stats.users.ADMIN} />
              <Stat Icon={Ban} tone="icon-tile--danger" label="Baneados" value={stats.users.banned} />
            </div>
          </section>

          <section>
            <SectionHeader title="Actividad" />
            <div className="role-stat-grid">
              <Stat Icon={Crown} tone="icon-tile--accent" label="Pro pagos" value={stats.premium.paid} />
              <Stat Icon={Crown} tone="icon-tile--accent" label="Pro por código" value={stats.premium.byCode} />
              <Stat Icon={Stethoscope} tone="" label="Nutricionistas aprobados" value={stats.nutritionists.approved} hint={`${stats.nutritionists.activeSubscriptions} con suscripción`} />
              <Stat Icon={Link2} tone="" label="Vínculos activos" value={stats.activeLinks} />
              <Stat Icon={Utensils} tone="" label="Platos registrados hoy" value={stats.mealsToday} />
            </div>
          </section>

          <p className="hint" style={{ textAlign: 'center' }}>Los planes y suscripciones están en modo de prueba: no hay cobros reales.</p>
        </>
      ) : null}

      <style>{`
        .admin-pending { display: flex; align-items: center; gap: 14px; text-decoration: none; color: var(--color-ink); }
        .admin-pending.is-on { background: var(--color-accent-soft); box-shadow: none; }
        .admin-pending__text { flex: 1; display: flex; flex-direction: column; }
        .admin-pending__text strong { font-size: 1rem; }
        .admin-pending__text span { font-size: 0.85rem; color: var(--color-ink-soft); }
      `}</style>
    </div>
  );
}

function Stat({ Icon, tone, label, value, hint }) {
  return (
    <div className="role-stat">
      <span className={`icon-tile ${tone}`}><Icon size={16} /></span>
      <strong>{value}</strong>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

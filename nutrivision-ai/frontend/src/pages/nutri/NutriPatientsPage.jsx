import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ChevronRight, Copy, KeyRound, RefreshCw, Users } from 'lucide-react';
import apiClient from '../../api/client';
import { Avatar, useConfirm } from '../../components/roles';
import { EmptyState, Message, PageTitle, SectionHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useNutri } from '../../context/NutriContext';
import { GOAL_OPTIONS, findOption } from '../../constants/profile';

const relative = (d) => {
  if (!d) return 'Todavía no registró comidas';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'Última comida: hoy';
  if (days === 1) return 'Última comida: ayer';
  return `Última comida: hace ${days} días`;
};

/** Pacientes vinculados y código de vinculación. */
export default function NutriPatientsPage() {
  const { profile: user } = useAuth();
  const { data, refresh, apply } = useNutri();
  const [patients, setPatients] = useState(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [ask, confirmModal] = useConfirm();

  const active = data?.subscription?.active;
  const linkCode = data?.profile?.linkCode;

  const load = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    try {
      const { data: res } = await apiClient.get(`/nutritionist/patients?todayFrom=${encodeURIComponent(start.toISOString())}`);
      setPatients(res.patients);
      setLocked(false);
      setError(null);
    } catch (err) {
      // 403: sin suscripción activa → las fichas quedan bloqueadas (los vínculos se conservan)
      if (/suscripción|aprobada/i.test(err.message)) {
        setLocked(true);
        setPatients([]);
      } else {
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => { load(); refresh(); }, [load, refresh]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(linkCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar. Seleccioná el código y copialo a mano.');
    }
  }

  const regenerate = () => ask({
    title: 'Generar código nuevo',
    message: 'El código actual deja de funcionar. Tus pacientes ya vinculados no se ven afectados.',
    confirmLabel: 'Generar',
    icon: <RefreshCw size={26} />,
    onConfirm: async () => {
      setRegenerating(true);
      try {
        const { data: res } = await apiClient.post('/nutritionist/me/link-code');
        apply(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setRegenerating(false);
      }
    },
  });

  const firstName = (user?.displayName || '').replace(/^(lic\.?|dra?\.?)\s+/i, '').split(' ')[0];

  return (
    <div className="page">
      <PageTitle
        title="Pacientes"
        subtitle={firstName ? `Hola, ${firstName}. Así vienen tus pacientes hoy.` : 'Así vienen tus pacientes hoy.'}
      />

      {!active ? (
        <Link to="/nutri/suscripcion" className="card nutri-warn">
          <AlertTriangle size={20} />
          <span className="nutri-warn__text">
            <strong>Tu suscripción no está activa</strong>
            <span>No aparecés en el directorio y no podés ver las fichas. Tus vínculos se conservan. Activala desde la app.</span>
          </span>
          <ChevronRight size={18} className="menu-row__chevron" />
        </Link>
      ) : null}

      <div className="nutri-patients">
        {/* Código de vinculación */}
        <section className="card nutri-code">
          <div className="nutri-code__head">
            <KeyRound size={18} color="var(--color-primary)" />
            <h3>Tu código de vinculación</h3>
          </div>
          <p className="nutri-code__value">{linkCode || '—'}</p>
          <p className="hint">Tus pacientes lo ingresan en la app, en Perfil → Mi nutricionista, y aceptan compartir su información con vos.</p>
          <div className="nutri-code__actions">
            <button type="button" className="btn btn-primary" onClick={copyCode} disabled={!linkCode}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={regenerate} disabled={regenerating}>
              <RefreshCw size={16} /> {regenerating ? 'Generando…' : 'Nuevo código'}
            </button>
          </div>
        </section>

        <section>
          <SectionHeader title={`Pacientes activos${data?.stats ? ` (${data.stats.activePatients})` : ''}`} />
          {error ? <Message>{error}</Message> : null}
          {patients === null ? (
            <p className="hint">Cargando…</p>
          ) : locked ? (
            <div className="card"><EmptyState icon={<Users size={24} />} title="Fichas bloqueadas" text="Activá tu suscripción desde la app para ver el progreso de tus pacientes." /></div>
          ) : patients.length === 0 ? (
            <div className="card"><EmptyState icon={<Users size={24} />} title="Todavía no tenés pacientes" text="Compartí tu código de vinculación para que tus pacientes se sumen." /></div>
          ) : (
            <div className="role-list">
              {patients.map((p) => <PatientRow key={p.id} p={p} />)}
            </div>
          )}
        </section>
      </div>

      {confirmModal}
      <style>{`
        .nutri-warn { display: flex; align-items: center; gap: 12px; background: var(--color-accent-soft); box-shadow: none; text-decoration: none; color: var(--color-ink); }
        .nutri-warn > svg:first-child { color: var(--color-accent); flex-shrink: 0; }
        .nutri-warn__text { flex: 1; display: flex; flex-direction: column; }
        .nutri-warn__text strong { font-size: 0.95rem; }
        .nutri-warn__text span { font-size: 0.83rem; color: var(--color-ink-soft); }
        .nutri-patients { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
        @media (max-width: 960px) { .nutri-patients { grid-template-columns: 1fr; } }
        .nutri-code { display: flex; flex-direction: column; gap: 10px; }
        .nutri-code__head { display: flex; align-items: center; gap: 8px; }
        .nutri-code__head h3 { margin: 0; font-size: 1rem; }
        .nutri-code__value {
          margin: 0; font-size: 1.9rem; font-weight: 800; letter-spacing: 5px; text-align: center;
          color: var(--color-primary-dark); background: var(--color-primary-soft); border-radius: var(--radius-md); padding: 12px;
          user-select: all;
        }
        .nutri-code__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .nutri-code__actions .btn { padding-left: 10px; padding-right: 10px; white-space: nowrap; }
        .nutri-patient__track { height: 6px; border-radius: 3px; background: var(--color-bg); overflow: hidden; margin: 3px 0; }
        .nutri-patient__fill { height: 100%; border-radius: 3px; background: var(--color-primary); }
        .nutri-patient__fill.is-over { background: var(--color-accent); }
      `}</style>
    </div>
  );
}

function PatientRow({ p }) {
  const goal = findOption(GOAL_OPTIONS, p.goal);
  const pct = p.today.calorieGoal ? Math.min(p.today.calories / p.today.calorieGoal, 1) : 0;
  const over = p.today.calorieGoal && p.today.calories > p.today.calorieGoal * 1.1;
  return (
    <Link to={`/nutri/pacientes/${p.id}`} className="role-list-item">
      <Avatar src={p.photoUrl} name={p.name} size={48} />
      <span className="role-list-item__body">
        <span className="role-list-item__name">{p.name}</span>
        <span className="role-list-item__meta">{goal?.label || 'Sin objetivo'}{p.weightKg ? ` · ${String(p.weightKg).replace('.', ',')} kg` : ''}</span>
        <span className="nutri-patient__track"><span className={`nutri-patient__fill${over ? ' is-over' : ''}`} style={{ width: `${pct * 100}%`, display: 'block' }} /></span>
        <span className="role-list-item__meta">
          Hoy: <strong style={{ color: 'var(--color-ink)' }}>{p.today.calories}</strong>{p.today.calorieGoal ? ` / ${p.today.calorieGoal}` : ''} kcal · {relative(p.lastMealAt)}
        </span>
      </span>
      <ChevronRight size={18} className="menu-row__chevron" />
    </Link>
  );
}

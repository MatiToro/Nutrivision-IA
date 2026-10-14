import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Crown, History, Pencil, Target, UserMinus, Utensils } from 'lucide-react';
import apiClient from '../../api/client';
import LoadingScreen from '../../components/LoadingScreen';
import MacroBar from '../../components/MacroBar';
import WeightChart from '../../components/WeightChart';
import { Avatar, BackButton, Tag, WeekBars, useConfirm } from '../../components/roles';
import { EmptyState, Message, PageTitle, SectionHeader } from '../../components/ui';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS, findOption } from '../../constants/profile';
import { addDays, longDate, pad, sameDay, startOfDay } from '../../utils/dates';

const FIELD_LABELS = {
  goal: 'Objetivo', dailyCalorieGoal: 'Calorías', dailyProteinGoalG: 'Proteínas', dailyCarbsGoalG: 'Carbohidratos', dailyFatGoalG: 'Grasas',
};
const fmtValue = (field, v) => {
  if (v == null) return '—';
  if (field === 'goal') return findOption(GOAL_OPTIONS, v)?.label ?? v;
  return field === 'dailyCalorieGoal' ? `${v} kcal` : `${v} g`;
};
const WHO = { YOU: 'Vos', PATIENT: 'El paciente', OTHER: 'Otro nutricionista' };

const sum = (meals) => meals.reduce((a, m) => ({
  calories: a.calories + (m.totalCalories || 0),
  proteinG: a.proteinG + (m.totalProteinG || 0),
  carbsG: a.carbsG + (m.totalCarbsG || 0),
  fatG: a.fatG + (m.totalFatG || 0),
}), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

// Inicio de la ventana de 7 días: offset 0 = los últimos 7 días (incluye hoy).
const windowStartIso = (offset) => addDays(startOfDay(new Date()), -6 - 7 * offset).toISOString();

/** Ficha del paciente: hoy, semana, comidas con foto, peso, objetivo y metas. */
export default function NutriPatientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(6);
  const [mealsByOffset, setMealsByOffset] = useState({});
  const [removing, setRemoving] = useState(false);
  const [ask, confirmModal] = useConfirm();

  const startKey = windowStartIso(offset);
  const today = startOfDay(new Date());

  const loadFile = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/nutritionist/patients/${id}`);
      setFile(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  const loadMeals = useCallback(async (off, fromIso) => {
    const from = new Date(fromIso);
    const to = addDays(from, 7);
    to.setMilliseconds(-1);
    try {
      const { data } = await apiClient.get(`/nutritionist/patients/${id}/meals?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
      setMealsByOffset((prev) => ({ ...prev, [off]: data.meals }));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => { loadFile(); }, [loadFile]);
  useEffect(() => { loadMeals(offset, startKey); }, [loadMeals, offset, startKey]);

  const meals = mealsByOffset[offset];
  const todayMeals = (mealsByOffset[0] || []).filter((m) => sameDay(new Date(m.loggedAt), today));
  const todayTotals = sum(todayMeals);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(startKey), i);
    const dayMeals = (meals || []).filter((m) => sameDay(new Date(m.loggedAt), date));
    return { date, ...sum(dayMeals), count: dayMeals.length };
  }), [meals, startKey]);
  const day = days[selectedDay];
  const changeWeek = (next) => { setOffset(next); setSelectedDay(6); };

  const remove = () => ask({
    title: 'Quitar paciente',
    message: `${file?.patient?.name || 'El paciente'} deja de estar vinculado y ya no vas a ver su información. Su valoración, si la dejó, se mantiene.`,
    confirmLabel: 'Quitar',
    danger: true,
    icon: <UserMinus size={26} />,
    onConfirm: async () => {
      setRemoving(true);
      try {
        await apiClient.delete(`/nutritionist/patients/${id}`);
        navigate('/nutri/pacientes', { replace: true });
      } catch (err) {
        setError(err.message);
        setRemoving(false);
      }
    },
  });

  if (!file && !error) return <LoadingScreen label="Cargando la ficha…" />;
  const p = file?.patient;
  const goalOpt = findOption(GOAL_OPTIONS, p?.goal);
  const GoalIcon = goalOpt?.Icon || Target;
  const activityOpt = findOption(ACTIVITY_OPTIONS, p?.activityLevel);
  const sexOpt = findOption(SEX_OPTIONS, p?.sex);

  return (
    <div className="page">
      <PageTitle title="Ficha del paciente" back={<BackButton fallback="/nutri/pacientes" />} />
      {error ? <Message>{error}</Message> : null}

      {p ? (
        <>
          <section className="card patient-hero">
            <Avatar src={p.photoUrl} name={p.name} size={64} />
            <div className="patient-hero__text">
              <h2>{p.name}</h2>
              <span>
                {[p.age ? `${p.age} años` : null, sexOpt?.label, p.heightCm ? `${p.heightCm} cm` : null, p.weightKg ? `${String(p.weightKg).replace('.', ',')} kg` : null].filter(Boolean).join(' · ')}
              </span>
              <span>Vinculado desde el {new Date(p.since).toLocaleDateString('es-AR')}</span>
            </div>
            {p.isPremium ? <span className="badge badge--accent"><Crown size={12} /> NutriVision Pro</span> : null}
          </section>

          <div className="grid-2">
            {/* Hoy */}
            <section className="card patient-card">
              <SectionHeader title="Hoy" />
              <div className="patient-today">
                <div className="patient-today__kcal">
                  <strong>{Math.round(todayTotals.calories)}</strong>
                  <span>kcal{p.dailyCalorieGoal ? ` de ${p.dailyCalorieGoal}` : ''}</span>
                </div>
                <div className="patient-today__macros">
                  <MacroBar label="Proteínas" value={todayTotals.proteinG} goal={p.dailyProteinGoalG} color="var(--macro-protein)" />
                  <MacroBar label="Carbs" value={todayTotals.carbsG} goal={p.dailyCarbsGoalG} color="var(--macro-carbs)" />
                  <MacroBar label="Grasas" value={todayTotals.fatG} goal={p.dailyFatGoalG} color="var(--macro-fats)" />
                </div>
              </div>
              <p className="hint">{todayMeals.length ? `${todayMeals.length} ${todayMeals.length === 1 ? 'comida registrada' : 'comidas registradas'} hoy.` : 'Todavía no registró comidas hoy.'}</p>
            </section>

            {/* Semana */}
            <section className="card patient-card">
              <div className="patient-week__head">
                <button type="button" className="icon-btn" onClick={() => changeWeek(offset + 1)} aria-label="Semana anterior"><ChevronLeft size={18} /></button>
                <h3>{offset === 0 ? 'Últimos 7 días' : `${days[0].date.getDate()}/${days[0].date.getMonth() + 1} – ${days[6].date.getDate()}/${days[6].date.getMonth() + 1}`}</h3>
                <button type="button" className="icon-btn" onClick={() => changeWeek(Math.max(0, offset - 1))} disabled={offset === 0} aria-label="Semana siguiente"><ChevronRight size={18} /></button>
              </div>
              {meals === undefined ? <p className="hint">Cargando…</p> : (
                <>
                  <WeekBars days={days} goal={p.dailyCalorieGoal} selected={selectedDay} onSelect={setSelectedDay} />
                  {/* Totales de macros del día elegido (las kcal ya se ven arriba) */}
                  <div className="patient-week__stats">
                    <DayStat label="Proteínas" value={day.proteinG} goal={p.dailyProteinGoalG} color="var(--macro-protein)" />
                    <DayStat label="Carbs" value={day.carbsG} goal={p.dailyCarbsGoalG} color="var(--macro-carbs)" />
                    <DayStat label="Grasas" value={day.fatG} goal={p.dailyFatGoalG} color="var(--macro-fats)" />
                  </div>
                  <p className="hint">
                    {day.count ? `${day.count} ${day.count === 1 ? 'comida registrada' : 'comidas registradas'} ese día.` : 'No registró comidas ese día.'} Hacé clic en una barra para ver otro día.
                  </p>
                </>
              )}
            </section>

            {/* Objetivo y metas */}
            <section className="card patient-card">
              <SectionHeader title="Objetivo y metas" />
              <div className="patient-goal">
                <span className="icon-tile"><GoalIcon size={20} /></span>
                <div>
                  <strong>{goalOpt?.label ?? 'Sin objetivo'}</strong>
                  <span>{activityOpt ? `Actividad: ${activityOpt.label}` : ''}</span>
                </div>
              </div>
              <div className="patient-goals">
                <GoalBox label="Calorías" value={p.dailyCalorieGoal} unit="kcal" />
                <GoalBox label="Proteínas" value={p.dailyProteinGoalG} unit="g" />
                <GoalBox label="Carbs" value={p.dailyCarbsGoalG} unit="g" />
                <GoalBox label="Grasas" value={p.dailyFatGoalG} unit="g" />
              </div>
              <Link to={`/nutri/pacientes/${id}/metas`} className="btn btn-primary btn-block"><Pencil size={16} /> Editar objetivo y metas</Link>
              <p className="hint">Cuando cambies sus metas, {p.name.split(' ')[0]} va a ver un aviso en su app.</p>
            </section>

            {/* Peso */}
            <section className="card patient-card">
              <SectionHeader title="Evolución de peso" />
              {file.weightLogs.length > 1 ? <WeightChart logs={file.weightLogs} /> : <p className="hint">Todavía no hay suficientes registros de peso para graficar.</p>}
            </section>
          </div>

          {/* Comidas del período */}
          <section className="card">
            <SectionHeader title={offset === 0 ? 'Comidas de los últimos 7 días' : 'Comidas de esa semana'} />
            {meals === undefined ? null : meals.length === 0 ? (
              <EmptyState icon={<Utensils size={24} />} title="Sin comidas registradas" text="No registró platos en estos días." />
            ) : (
              meals.map((m) => {
                const d = new Date(m.loggedAt);
                return (
                  <Link key={m.id} to={`/nutri/pacientes/${id}/comidas/${m.id}`} className="meal-row">
                    {m.imageUrl ? <img src={m.imageUrl} alt="" className="meal-row__thumb" /> : <span className="meal-row__thumb" />}
                    <span className="meal-row__body">
                      <span className="meal-row__name">{m.name || 'Comida'}</span>
                      <span className="hint">{longDate(d)}, {pad(d.getHours())}:{pad(d.getMinutes())} h</span>
                    </span>
                    <span className="meal-row__kcal">{Math.round(m.totalCalories || 0)} kcal</span>
                    <ChevronRight size={16} className="meal-row__chevron" />
                  </Link>
                );
              })
            )}
          </section>

          {file.goalChanges.length ? (
            <section className="card">
              <SectionHeader title="Cambios de objetivo y metas" icon={<History size={17} color="var(--color-ink-soft)" />} />
              {file.goalChanges.map((g) => (
                <div key={g.id} className="patient-hist">
                  <Tag label={`${WHO[g.by]} · ${new Date(g.createdAt).toLocaleDateString('es-AR')}`} tone={g.by === 'YOU' ? 'green' : 'gray'} />
                  {Object.entries(g.changes).map(([field, ch]) => (
                    <span key={field}>{FIELD_LABELS[field] || field}: {fmtValue(field, ch.from)} → <strong>{fmtValue(field, ch.to)}</strong></span>
                  ))}
                </div>
              ))}
            </section>
          ) : null}

          <button type="button" className="role-danger-btn" onClick={remove} disabled={removing}>
            <UserMinus size={18} /> {removing ? 'Quitando…' : 'Quitar paciente'}
          </button>
        </>
      ) : null}

      {confirmModal}
      <style>{`
        .patient-hero { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .patient-hero__text { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 2px; }
        .patient-hero__text h2 { margin: 0; }
        .patient-hero__text span { font-size: 0.85rem; color: var(--color-ink-soft); }
        .patient-card { display: flex; flex-direction: column; gap: 12px; }
        .patient-card .section-header { margin-bottom: 0; }
        .patient-today { display: flex; align-items: center; gap: 20px; }
        .patient-today__kcal {
          width: 120px; height: 120px; border-radius: 50%; border: 10px solid var(--color-primary-soft);
          display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .patient-today__kcal strong { font-size: 1.7rem; font-weight: 800; line-height: 1.1; }
        .patient-today__kcal span { font-size: 0.72rem; color: var(--color-ink-soft); font-weight: 600; text-align: center; }
        .patient-today__macros { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
        .patient-today__macros .macro-bar__track { background: var(--color-bg); }
        .patient-week__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .patient-week__head h3 { margin: 0; font-size: 1rem; }
        .patient-week__head .icon-btn { background: var(--color-bg); box-shadow: none; }
        .patient-week__head .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .patient-week__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .patient-stat { background: var(--color-bg); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 2px; }
        .patient-stat__top { display: flex; align-items: center; gap: 5px; font-size: 0.74rem; font-weight: 600; color: var(--color-ink-soft); }
        .patient-stat__dot { width: 8px; height: 8px; border-radius: 50%; }
        .patient-stat strong { font-size: 1.1rem; font-weight: 800; }
        .patient-stat small { font-size: 0.72rem; color: var(--color-ink-muted); }
        .patient-goal { display: flex; align-items: center; gap: 12px; }
        .patient-goal div { display: flex; flex-direction: column; }
        .patient-goal strong { font-size: 1rem; }
        .patient-goal span { font-size: 0.8rem; color: var(--color-ink-soft); }
        .patient-goals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .patient-goalbox { background: var(--color-bg); border-radius: var(--radius-md); padding: 10px 12px; display: flex; flex-direction: column; }
        .patient-goalbox span { font-size: 0.76rem; color: var(--color-ink-soft); font-weight: 600; }
        .patient-goalbox strong { font-size: 1.15rem; font-weight: 800; }
        .patient-goalbox small { font-size: 0.76rem; color: var(--color-ink-soft); font-weight: 600; }
        .patient-hist { display: flex; flex-direction: column; gap: 3px; padding: 10px 0; border-top: 1px solid var(--color-line); font-size: 0.88rem; }
      `}</style>
    </div>
  );
}

function DayStat({ label, value, goal, color }) {
  return (
    <div className="patient-stat">
      <span className="patient-stat__top"><span className="patient-stat__dot" style={{ background: color }} />{label}</span>
      <strong>{Math.round(value)} g</strong>
      <small>{goal ? `de ${goal} g` : 'sin meta'}</small>
    </div>
  );
}

function GoalBox({ label, value, unit }) {
  return (
    <div className="patient-goalbox">
      <span>{label}</span>
      <strong>{value ?? '—'} <small>{unit}</small></strong>
    </div>
  );
}

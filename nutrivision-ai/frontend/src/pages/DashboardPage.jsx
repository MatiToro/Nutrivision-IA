import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, Sparkles, Utensils, ChevronRight, Smartphone, Apple, PlayCircle, BarChart3 } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import DayDetailModal from '../components/DayDetailModal';
import LoadingScreen from '../components/LoadingScreen';
import { EmptyState, Message, SectionHeader, greeting } from '../components/ui';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CHART_H = 120;

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [week, setWeek] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const monday = getMonday(new Date());

        const [summaryRes, todayRes, weekRes] = await Promise.all([
          apiClient.get('/history/summary'),
          apiClient.get(`/history/meals?from=${startOfDay.toISOString()}`),
          apiClient.get(`/history/meals?from=${monday.toISOString()}`),
        ]);

        setSummary(summaryRes.data);
        setTodayMeals(todayRes.data.meals);
        setWeek(buildWeek(weekRes.data.meals, monday, summaryRes.data.today.goal));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingScreen label="Cargando tu panel…" />;

  const firstName = (profile?.displayName || '').split(' ')[0];
  const totals = summary?.today.totals;
  const goal = summary?.today.goal;
  const caloriesPct = goal?.calories ? Math.min(((totals?.calories || 0) / goal.calories) * 100, 100) : 0;
  const todayIndex = getTodayIndex();
  const todayLabel = capitalize(new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));

  // Mismos tonos claros que la tarjeta verde de la app mobile
  const macros = [
    { key: 'protein', label: 'Proteínas', value: totals?.proteinG, goal: goal?.proteinG, color: '#93C5FD' },
    { key: 'carbs', label: 'Carbohidratos', value: totals?.carbsG, goal: goal?.carbsG, color: '#FDE047' },
    { key: 'fats', label: 'Grasas', value: totals?.fatG, goal: goal?.fatG, color: '#FCA5A5' },
  ];

  const R = 62;
  const ringCircumference = 2 * Math.PI * R;
  const ringOffset = ringCircumference * (1 - caloriesPct / 100);

  // Escala del gráfico semanal: la meta (100 %) queda a la misma altura todos los días.
  const topPct = Math.max(120, ...week.map((d) => d.pct));
  const goalY = CHART_H - (100 / topPct) * CHART_H;

  return (
    <div className="page dashboard">
      <div className="dashboard__intro">
        <h1>{firstName ? `¡${greeting()}, ${firstName}!` : `¡${greeting()}!`}</h1>
        <p>Tu objetivo está más cerca de lo que pensás. ¡Vamos!</p>
      </div>

      {error && <Message>{error}</Message>}

      <div className="dashboard__top">
        {/* Progreso del día */}
        <section className="dashboard__progress">
          <div className="dashboard__progress-head">
            <h3>Tu progreso del día</h3>
            <span className="badge badge--light">{todayLabel}</span>
          </div>

          <div className="dashboard__progress-body">
            <div className="dashboard__ring">
              <svg viewBox="0 0 150 150" aria-hidden="true">
                <circle cx="75" cy="75" r={R} strokeWidth="13" stroke="rgba(255,255,255,0.25)" fill="none" />
                <circle
                  cx="75" cy="75" r={R} strokeWidth="13" fill="none" stroke="#fff"
                  className="dashboard__ring-fill"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 75 75)"
                />
              </svg>
              <div className="dashboard__ring-center">
                <strong>{Math.round(totals?.calories || 0)}</strong>
                <span>kcal</span>
                <small>{goal?.calories ? `de ${goal.calories}` : 'meta sin definir'}</small>
              </div>
            </div>

            <div className="dashboard__macros">
              {macros.map((m) => (
                <div className="dashboard__macro" key={m.key}>
                  <div className="dashboard__macro-top">
                    <span className="dashboard__macro-dot" style={{ backgroundColor: m.color }} />
                    <span className="dashboard__macro-label">{m.label}</span>
                    <span className="dashboard__macro-value">
                      {Math.round(m.value || 0)} g<span> / {m.goal ? `${Math.round(m.goal)} g` : '—'}</span>
                    </span>
                  </div>
                  <div className="dashboard__macro-track">
                    <div
                      className="dashboard__macro-fill"
                      style={{ width: `${m.goal ? Math.min(((m.value || 0) / m.goal) * 100, 100) : 0}%`, backgroundColor: m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="button" className="dashboard__progress-link" onClick={() => navigate('/history')}>
            Ver detalle completo <ArrowRight size={15} />
          </button>
        </section>

        {/* CTA de escaneo */}
        <Link to="/scan" className="dashboard__scan">
          <div className="dashboard__scan-text">
            <span className="badge badge--white"><Sparkles size={12} /> Escaneo con IA</span>
            <h2>¿Qué hay en tu plato?</h2>
            <p>Sacá una foto de tu comida y obtené los macros al instante.</p>
            <span className="dashboard__scan-link">Escanear plato <ArrowRight size={16} /></span>
          </div>
          <span className="dashboard__scan-icon"><Camera size={36} /></span>
        </Link>
      </div>

      <div className="grid-2">
        {/* Comidas de hoy */}
        <section className="card">
          <SectionHeader title="Comidas de hoy" action="Ver historial" onAction={() => navigate('/history')} />
          {todayMeals.length === 0 ? (
            <EmptyState
              icon={<Utensils size={24} />}
              title="Todavía no registraste comidas"
              text="Escaneá tu primer plato del día y lo vas a ver acá."
            >
              <Link to="/scan" className="btn btn-primary" style={{ marginTop: 14 }}>
                <Camera size={17} /> Escanear plato
              </Link>
            </EmptyState>
          ) : (
            <div>
              {todayMeals.map((meal) => (
                <Link to={`/meals/${meal.id}`} key={meal.id} className="meal-row">
                  {meal.imageUrl ? <img src={meal.imageUrl} alt="" className="meal-row__thumb" /> : null}
                  <span className="meal-row__body">
                    <span className="meal-row__name">{meal.name || mealTypeFromTime(meal.loggedAt)}</span>
                    <span className="meal-row__meta">
                      <span style={{ color: 'var(--macro-protein)' }}>P {Math.round(meal.totalProteinG)}g</span>
                      {'  ·  '}
                      <span style={{ color: 'var(--macro-carbs)' }}>C {Math.round(meal.totalCarbsG)}g</span>
                      {'  ·  '}
                      <span style={{ color: 'var(--macro-fats)' }}>G {Math.round(meal.totalFatG)}g</span>
                    </span>
                  </span>
                  <span className="meal-row__kcal">{Math.round(meal.totalCalories)} kcal</span>
                  <ChevronRight size={16} className="meal-row__chevron" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Resumen semanal */}
        <section className="card">
          <SectionHeader title="Resumen semanal" icon={<BarChart3 size={18} color="var(--color-primary)" />} />
          <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
            % de tu meta de calorías de cada día · tocá un día para ver el detalle
          </p>
          <div className="week-chart">
            <div className="week-chart__bars">
              <div className="week-chart__goal" style={{ top: goalY }}><span>meta</span></div>
              {week.map((day, i) => {
                const isToday = i === todayIndex;
                const h = day.hasData ? Math.max((day.pct / topPct) * CHART_H, 4) : 0;
                const over = day.pct > 110;
                return (
                  <button
                    key={day.fullDate}
                    type="button"
                    disabled={!day.hasData}
                    onClick={() => setSelectedDay(day)}
                    className="week-chart__col"
                    aria-label={day.hasData ? `${day.fullDate}: ${day.pct}% de la meta` : `${day.fullDate}: sin comidas`}
                  >
                    <span
                      className={`week-chart__bar${isToday ? ' is-today' : ''}${over ? ' is-over' : ''}`}
                      style={{ height: h }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="week-chart__labels">
              {week.map((day, i) => (
                <span key={day.fullDate} className={i === todayIndex ? 'is-today' : ''}>
                  {DAY_LABELS[i]}
                  <strong>{day.hasData ? `${day.pct}%` : '–'}</strong>
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Banner app mobile */}
      <section className="card dashboard__app">
        <span className="icon-tile icon-tile--gradient dashboard__app-icon"><Smartphone size={26} /></span>
        <div className="dashboard__app-text">
          <h3>Llevá NutriVision IA en tu celular</h3>
          <p>Analizá tus comidas, seguí tu progreso y alcanzá tus objetivos, donde quieras.</p>
          <Link to="/download" className="section-header__action">Descargar app →</Link>
        </div>
        <div className="dashboard__stores">
          <span className="dashboard__store"><Apple size={17} /> App Store</span>
          <span className="dashboard__store"><PlayCircle size={17} /> Google Play</span>
        </div>
      </section>

      {selectedDay && goal && (
        <DayDetailModal day={selectedDay} goal={goal} onClose={() => setSelectedDay(null)} />
      )}

      <style>{`
        .dashboard__intro h1 { margin: 0; }
        .dashboard__intro p { margin: 2px 0 0; color: var(--color-ink-soft); font-size: 0.92rem; }

        .dashboard__top { display: grid; grid-template-columns: 1.15fr 1fr; gap: 20px; align-items: stretch; }
        @media (max-width: 960px) { .dashboard__top { grid-template-columns: 1fr; gap: 16px; } }

        /* Progreso del día */
        .dashboard__progress {
          background: var(--gradient-primary); border-radius: var(--radius-lg); padding: 20px; color: #fff;
          display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-card);
        }
        .dashboard__progress-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .dashboard__progress-head h3 { margin: 0; color: #fff; font-size: 1.02rem; font-weight: 800; }
        .dashboard__progress-body { display: flex; align-items: center; gap: 20px; flex: 1; }
        @media (max-width: 420px) { .dashboard__progress-body { gap: 14px; } }

        .dashboard__ring { position: relative; width: 140px; height: 140px; flex-shrink: 0; }
        @media (max-width: 420px) { .dashboard__ring { width: 118px; height: 118px; } }
        .dashboard__ring svg { width: 100%; height: 100%; display: block; }
        .dashboard__ring-fill { transition: stroke-dashoffset 0.6s ease; }
        .dashboard__ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .dashboard__ring-center strong { font-size: 1.9rem; font-weight: 800; line-height: 1.05; }
        .dashboard__ring-center span { font-size: 0.78rem; font-weight: 600; opacity: 0.85; }
        .dashboard__ring-center small { font-size: 0.72rem; opacity: 0.75; margin-top: 2px; }

        .dashboard__macros { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
        .dashboard__macro-top { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; font-size: 0.85rem; }
        .dashboard__macro-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dashboard__macro-label { flex: 1; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dashboard__macro-value { font-weight: 800; white-space: nowrap; }
        .dashboard__macro-value span { font-weight: 500; opacity: 0.75; }
        .dashboard__macro-track { height: 6px; background: rgba(255,255,255,0.25); border-radius: 3px; overflow: hidden; }
        .dashboard__macro-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

        .dashboard__progress-link {
          display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
          background: rgba(255,255,255,0.18); border: none; color: #fff;
          padding: 8px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 800; cursor: pointer;
        }
        .dashboard__progress-link:hover { background: rgba(255,255,255,0.28); }

        /* Escaneo */
        .dashboard__scan {
          display: flex; align-items: center; gap: 16px; background: var(--color-primary-soft);
          border-radius: var(--radius-lg); padding: 22px; text-decoration: none; color: var(--color-ink);
          transition: transform 0.12s ease, box-shadow 0.15s ease;
        }
        .dashboard__scan:hover { box-shadow: 0 10px 26px rgba(24,155,78,0.16); transform: translateY(-1px); }
        .dashboard__scan-text { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .dashboard__scan-text h2 { margin: 4px 0 0; font-size: 1.4rem; }
        .dashboard__scan-text p { margin: 0; color: var(--color-ink-soft); font-size: 0.9rem; }
        .dashboard__scan-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--color-primary); font-weight: 800; font-size: 0.92rem; }
        .dashboard__scan-icon {
          width: 84px; height: 84px; border-radius: 26px; background: var(--gradient-primary); color: #fff;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-float);
        }

        /* Gráfico semanal */
        .week-chart { display: flex; flex-direction: column; gap: 8px; }
        .week-chart__bars {
          position: relative; height: ${CHART_H}px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px;
          border-bottom: 1px solid var(--color-line);
        }
        .week-chart__goal { position: absolute; left: 0; right: 0; border-top: 1.5px dashed var(--color-ink-muted); pointer-events: none; }
        .week-chart__goal span {
          position: absolute; right: 0; top: -17px; font-size: 0.66rem; font-weight: 700; color: var(--color-ink-muted);
          background: var(--color-surface); padding: 0 4px;
        }
        .week-chart__col {
          display: flex; align-items: flex-end; background: none; border: none; padding: 0; cursor: pointer;
          border-radius: 10px 10px 0 0;
        }
        .week-chart__col:disabled { cursor: default; }
        .week-chart__col:not(:disabled):hover .week-chart__bar { opacity: 1; }
        .week-chart__bar {
          width: 100%; border-radius: 8px 8px 0 0; background: var(--color-primary); opacity: 0.5;
          transition: height 0.5s ease, opacity 0.12s ease;
        }
        .week-chart__bar.is-today { opacity: 1; }
        .week-chart__bar.is-over { background: var(--color-accent); }
        .week-chart__labels { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
        .week-chart__labels span {
          display: flex; flex-direction: column; align-items: center; font-size: 0.74rem; font-weight: 600; color: var(--color-ink-muted);
        }
        .week-chart__labels strong { font-size: 0.76rem; font-weight: 800; color: var(--color-ink-soft); }
        .week-chart__labels span.is-today, .week-chart__labels span.is-today strong { color: var(--color-primary); }
        @media (max-width: 480px) { .week-chart__bars, .week-chart__labels { gap: 5px; } }

        /* Banner app */
        .dashboard__app { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .dashboard__app-icon { width: 56px; height: 56px; border-radius: 18px; }
        .dashboard__app-text { flex: 1; min-width: 220px; }
        .dashboard__app-text h3 { margin: 0 0 2px; }
        .dashboard__app-text p { margin: 0 0 6px; color: var(--color-ink-soft); font-size: 0.88rem; }
        .dashboard__stores { display: flex; gap: 8px; flex-wrap: wrap; }
        .dashboard__store {
          display: inline-flex; align-items: center; gap: 7px; background: var(--color-ink); color: #fff;
          padding: 9px 14px; border-radius: var(--radius-md); font-size: 0.82rem; font-weight: 700; white-space: nowrap;
        }
      `}
      </style>
    </div>
  );
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mealTypeFromTime(isoDate) {
  const hour = new Date(isoDate).getHours();
  if (hour < 11) return 'Desayuno';
  if (hour < 16) return 'Almuerzo';
  if (hour < 19) return 'Merienda';
  return 'Cena';
}

function buildWeek(meals, monday, goal) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    const dayMeals = meals.filter((m) => sameDay(new Date(m.loggedAt), date));
    const fullDate = capitalize(date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));

    if (dayMeals.length === 0) {
      return { hasData: false, pct: 0, fullDate, totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, meals: [] };
    }

    const totals = dayMeals.reduce((acc, m) => ({
      calories: acc.calories + (m.totalCalories || 0),
      proteinG: acc.proteinG + (m.totalProteinG || 0),
      carbsG: acc.carbsG + (m.totalCarbsG || 0),
      fatG: acc.fatG + (m.totalFatG || 0),
    }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

    const pct = goal?.calories ? Math.round((totals.calories / goal.calories) * 100) : 0;

    return { hasData: true, pct, fullDate, totals, meals: dayMeals };
  });
}

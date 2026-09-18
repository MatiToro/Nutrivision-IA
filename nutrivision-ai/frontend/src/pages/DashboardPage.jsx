import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Calendar, TrendingUp, Apple, PlayCircle, ArrowRight, Sparkles } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import DayDetailModal from '../components/DayDetailModal';
import LoadingScreen from '../components/LoadingScreen';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

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

  const macros = [
    { key: 'protein', label: 'Proteínas', value: totals?.proteinG, goal: goal?.proteinG, color: 'var(--macro-protein)' },
    { key: 'carbs', label: 'Carbohidratos', value: totals?.carbsG, goal: goal?.carbsG, color: 'var(--macro-carbs)' },
    { key: 'fats', label: 'Grasas', value: totals?.fatG, goal: goal?.fatG, color: 'var(--macro-fats)' },
  ];

  const ringCircumference = 2 * Math.PI * 68;
  const ringOffset = ringCircumference * (1 - caloriesPct / 100);

  return (
    <div className="container dashboard">
      <div className="dashboard__intro">
        <h1>{firstName ? `Hola, ${firstName}!` : 'Tu panel de hoy'}</h1>
        <p className="helper-text">Tu objetivo está más cerca de lo que pensás. ¡Vamos!</p>
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="dashboard__top-grid">
        {/* Progreso del día */}
        <section className="dashboard__progress-card">
          <div className="dashboard__progress-header">
            <h3>Tu progreso del día</h3>
            <span className="dashboard__progress-date"><Calendar size={13} /> {todayLabel}</span>
          </div>

          <div className="dashboard__progress-body">
            <div className="dashboard__ring">
              <svg viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="68" strokeWidth="14" className="dashboard__ring-track" fill="none" />
                <circle
                  cx="80" cy="80" r="68" strokeWidth="14" fill="none"
                  className="dashboard__ring-fill"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div className="dashboard__ring-center">
                <span className="mono-num">{Math.round(totals?.calories || 0)}</span>
                <span>kcal</span>
                <span className="dashboard__ring-goal">de {goal?.calories ?? '—'}</span>
              </div>
            </div>

            <div className="dashboard__macro-rows">
              {macros.map((m) => (
                <div className="dashboard__macro-row" key={m.key}>
                  <div className="dashboard__macro-row-top">
                    <span className="dashboard__macro-dot" style={{ backgroundColor: m.color }} />
                    <span>{m.label}</span>
                    <span className="mono-num dashboard__macro-row-value">
                      {Math.round(m.value || 0)} g <span className="dashboard__macro-row-goal">/ {Math.round(m.goal || 0)} g</span>
                    </span>
                  </div>
                  <div className="dashboard__macro-row-track">
                    <div
                      className="dashboard__macro-row-fill"
                      style={{ width: `${m.goal ? Math.min((m.value / m.goal) * 100, 100) : 0}%`, backgroundColor: m.color }}
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
        <section className="dashboard__scan-card">
          <div className="dashboard__scan-text">
            <span className="dashboard__scan-badge"><Camera size={13} /> Escaneo con IA</span>
            <h2>¿Qué hay en tu plato?</h2>
            <p>Sacá una foto de tu comida y obtené los macros al instante.</p>
            <Link to="/scan" className="dashboard__scan-btn">
              Escanear plato <ArrowRight size={16} />
            </Link>
          </div>
          <img src="/scan-cta.jpg" alt="Sacá una foto de tu plato para analizarlo con IA" className="dashboard__scan-img" />
        </section>
      </div>

      {/* Comidas de hoy */}
      <section className="card dashboard__meals">
        <div className="dashboard__meals-header">
          <h3>Comidas de hoy</h3>
          <Link to="/history" className="dashboard__see-all">Ver todo</Link>
        </div>
        {todayMeals.length === 0 ? (
          <p className="helper-text">Todavía no registraste ninguna comida hoy.</p>
        ) : (
          <div className="dashboard__meal-list">
            {todayMeals.map((meal) => (
              <Link to={`/meals/${meal.id}`} key={meal.id} className="dashboard__meal-row">
                <img src={meal.imageUrl} alt="" className="dashboard__meal-thumb" />
                <span className="dashboard__meal-name">{meal.name || mealTypeFromTime(meal.loggedAt)}</span>
                <span className="mono-num dashboard__meal-kcal">{Math.round(meal.totalCalories)} kcal</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Banner app mobile */}
      <section className="dashboard__mobile-banner">
        <div className="dashboard__mobile-blob dashboard__mobile-blob--a" />
        <div className="dashboard__mobile-blob dashboard__mobile-blob--b" />
        <div className="dashboard__mobile-icon"><Sparkles size={26} color="#fff" /></div>
        <div className="dashboard__mobile-text">
          <h3>Llevá NutriVision IA en tu celular</h3>
          <p>Analizá tus comidas, seguí tu progreso y alcanzá tus objetivos, donde quieras.</p>
          <Link to="/download" className="dashboard__mobile-link">Descargar app <ArrowRight size={15} /></Link>
        </div>
        <div className="dashboard__mobile-badges">
          <span className="dashboard__store-badge"><Apple size={17} /> App Store</span>
          <span className="dashboard__store-badge"><PlayCircle size={17} /> Google Play</span>
        </div>
      </section>

      {/* Resumen semanal */}
      <section className="card dashboard__week">
        <div className="dashboard__week-title">
          <TrendingUp size={18} color="var(--color-primary)" />
          <h3>Resumen Semanal</h3>
          <span className="helper-text">· Tocá un día para ver el detalle</span>
        </div>
        <div className="dashboard__week-bars">
          {week.map((day, i) => {
            const isToday = i === todayIndex;
            const clickable = day.hasData;
            return (
              <button
                key={day.fullDate}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setSelectedDay(day)}
                className={`dashboard__week-col${clickable ? ' is-clickable' : ''}`}
              >
                <span className={`dashboard__week-day${isToday ? ' is-today' : ''}`}>{DAY_LABELS[i]}</span>
                <div className="dashboard__week-track">
                  {day.hasData && (
                    <div
                      className={`dashboard__week-fill${isToday ? ' is-today' : ''}`}
                      style={{ height: `${Math.max(day.pct, 4)}%` }}
                    />
                  )}
                </div>
                <span className="dashboard__week-pct">{day.hasData ? `${day.pct}%` : '–'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedDay && goal && (
        <DayDetailModal day={selectedDay} goal={goal} onClose={() => setSelectedDay(null)} />
      )}

      <style>{`
        .dashboard { padding: 32px 24px 64px; }
        .dashboard__intro { margin-bottom: 20px; }
        .dashboard__intro h1 { margin: 0 0 2px; font-size: 1.85rem; }

        .dashboard__top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; align-items: stretch; }
        @media (max-width: 900px) { .dashboard__top-grid { grid-template-columns: 1fr; } }

        /* Tarjeta de progreso */
        .dashboard__progress-card {
          background: var(--gradient-primary); border-radius: var(--radius-lg); padding: 26px; color: #fff;
          display: flex; flex-direction: column;
        }
        .dashboard__progress-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 8px; }
        .dashboard__progress-header h3 { margin: 0; font-size: 1.05rem; }
        .dashboard__progress-date { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; opacity: 0.85; }
        .dashboard__progress-body { display: flex; align-items: center; gap: 24px; flex: 1; flex-wrap: wrap; }

        .dashboard__ring { position: relative; width: 150px; height: 150px; flex-shrink: 0; }
        .dashboard__ring svg { width: 100%; height: 100%; }
        .dashboard__ring-track { stroke: rgba(255,255,255,0.25); }
        .dashboard__ring-fill { stroke: #fff; transition: stroke-dashoffset 0.5s ease; }
        .dashboard__ring-center {
          position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .dashboard__ring-center .mono-num { font-size: 1.7rem; font-weight: 700; line-height: 1; }
        .dashboard__ring-center span:nth-child(2) { font-size: 0.78rem; opacity: 0.85; }
        .dashboard__ring-goal { font-size: 0.72rem; opacity: 0.75; margin-top: 4px; }

        .dashboard__macro-rows { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 14px; }
        .dashboard__macro-row-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.85rem; }
        .dashboard__macro-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .dashboard__macro-row-value { margin-left: auto; font-weight: 700; }
        .dashboard__macro-row-goal { font-weight: 500; opacity: 0.75; }
        .dashboard__macro-row-track { height: 6px; background: rgba(255,255,255,0.25); border-radius: 999px; overflow: hidden; }
        .dashboard__macro-row-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }

        .dashboard__progress-link {
          display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; margin-top: 18px;
          background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.3); color: #fff;
          padding: 9px 16px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; cursor: pointer;
        }
        .dashboard__progress-link:hover { background: rgba(255,255,255,0.26); }

        /* Tarjeta de escaneo */
        .dashboard__scan-card {
          background: var(--color-primary-soft); border-radius: var(--radius-lg); padding: 26px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: center; overflow: hidden;
        }
        .dashboard__scan-badge {
          display: inline-flex; align-items: center; gap: 6px; background: var(--color-surface); color: var(--color-primary);
          font-size: 0.74rem; font-weight: 700; padding: 5px 12px; border-radius: 999px; margin-bottom: 12px;
        }
        .dashboard__scan-text h2 { margin: 0 0 8px; font-size: 1.4rem; }
        .dashboard__scan-text p { margin: 0 0 16px; color: var(--color-ink-soft); font-size: 0.9rem; }
        .dashboard__scan-btn {
          display: inline-flex; align-items: center; gap: 8px; background: var(--gradient-primary); color: #fff;
          padding: 11px 20px; border-radius: var(--radius-md); font-weight: 700; text-decoration: none; font-size: 0.9rem;
        }
        .dashboard__scan-btn:hover { filter: brightness(1.05); }
        .dashboard__scan-img { width: 100%; border-radius: var(--radius-md); object-fit: cover;}
        @media (max-width: 620px) { .dashboard__scan-card { grid-template-columns: 1fr; } }

        /* Comidas de hoy */
        .dashboard__meals { padding: 22px; margin-bottom: 20px; }
        .dashboard__meals-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .dashboard__meals-header h3 { margin: 0; font-size: 1.05rem; }
        .dashboard__see-all { font-size: 0.85rem; font-weight: 700; text-decoration: none; }
        .dashboard__meal-list { display: flex; flex-direction: column; }
        .dashboard__meal-row {
          display: flex; align-items: center; gap: 12px; padding: 9px 4px; border-bottom: 1px solid var(--color-line);
          text-decoration: none; color: var(--color-ink); border-radius: var(--radius-sm); transition: background 0.12s ease;
        }
        .dashboard__meal-row:last-child { border-bottom: none; }
        .dashboard__meal-row:hover { background: var(--color-bg); }
        .dashboard__meal-thumb { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
        .dashboard__meal-name { font-weight: 700; font-size: 0.9rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dashboard__meal-kcal { font-size: 0.85rem; font-weight: 700; flex-shrink: 0; }

        /* Banner mobile */
        .dashboard__mobile-banner {
          position: relative; overflow: hidden; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
          background: var(--color-primary-soft); border-radius: var(--radius-lg); padding: 24px 28px; margin-bottom: 20px;
        }
        .dashboard__mobile-blob { position: absolute; border-radius: 50%; background: rgba(24,155,78,0.08); }
        .dashboard__mobile-blob--a { width: 220px; height: 220px; right: -70px; top: -90px; }
        .dashboard__mobile-blob--b { width: 160px; height: 160px; left: -60px; bottom: -80px; }
        .dashboard__mobile-icon {
          position: relative; z-index: 1; width: 52px; height: 52px; border-radius: var(--radius-md); background: var(--gradient-primary);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .dashboard__mobile-text { position: relative; z-index: 1; flex: 1; min-width: 220px; }
        .dashboard__mobile-text h3 { margin: 0 0 4px; font-size: 1.15rem; }
        .dashboard__mobile-text p { margin: 0 0 8px; color: var(--color-ink-soft); font-size: 0.88rem; }
        .dashboard__mobile-link { display: inline-flex; align-items: center; gap: 6px; color: var(--color-primary); font-weight: 700; text-decoration: none; font-size: 0.88rem; }
        .dashboard__mobile-badges { position: relative; z-index: 1; display: flex; gap: 10px; flex-wrap: wrap; }
        .dashboard__store-badge {
          display: flex; align-items: center; gap: 8px; background: var(--color-ink); color: #fff;
          padding: 10px 16px; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 700; white-space: nowrap;
        }

        /* Resumen semanal */
        .dashboard__week { padding: 22px; }
        .dashboard__week-title { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; }
        .dashboard__week-title h3 { margin: 0; font-size: 1.05rem; }
        .dashboard__week-bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
        .dashboard__week-col {
          display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none;
          padding: 6px; border-radius: var(--radius-sm); cursor: default;
        }
        .dashboard__week-col.is-clickable { cursor: pointer; }
        .dashboard__week-col.is-clickable:hover { background: var(--color-bg); }
        .dashboard__week-day { font-size: 0.78rem; font-weight: 600; color: var(--color-ink-soft); }
        .dashboard__week-day.is-today { color: var(--color-primary); }
        .dashboard__week-track {
          width: 100%; height: 80px; background: var(--color-bg); border-radius: 10px;
          display: flex; align-items: flex-end; overflow: hidden;
        }
        .dashboard__week-fill { width: 100%; background: rgba(24,155,78,0.4); border-radius: 10px; transition: height 0.4s ease; }
        .dashboard__week-fill.is-today { background: var(--color-primary); }
        .dashboard__week-pct { font-size: 0.78rem; font-weight: 700; }

        @media (max-width: 620px) { .dashboard__week-bars { gap: 4px; } .dashboard__week-track { height: 56px; } }
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

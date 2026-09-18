import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Paperclip } from 'lucide-react';
import apiClient from '../api/client';
import LoadingScreen from '../components/LoadingScreen';

export default function HistoryPage() {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const from = startOfMonth(monthDate).toISOString();
        const to = endOfMonth(monthDate).toISOString();
        const { data } = await apiClient.get(`/history/meals?from=${from}&to=${to}`);
        if (!cancelled) setMeals(data.meals);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [monthDate]);

  const monthLabel = capitalize(monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));

  return (
    <div className="container history-page">
      <div className="history-page__header">
        <div>
          <h1>Historial de comidas</h1>
          <p className="helper-text">Revisá lo que comiste y cómo se distribuyen tus macros.</p>
        </div>

        <div className="history-page__controls">
          <div className="history-page__month">
            <button type="button" onClick={() => setMonthDate((d) => addMonths(d, -1))} aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <span><Calendar size={15} /> {monthLabel}</span>
            <button type="button" onClick={() => setMonthDate((d) => addMonths(d, 1))} aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
          <Link to="/scan" className="btn btn-primary">
            <Paperclip size={17} /> Cargar plato
          </Link>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      {loading ? (
        <LoadingScreen label="Cargando tu historial…" />
      ) : meals.length === 0 ? (
        <div className="card history-page__empty">
          <p>No hay platos registrados en {monthLabel.toLowerCase()}.</p>
          <Link to="/scan" className="btn btn-primary">Escanear un plato</Link>
        </div>
      ) : (
        <div className="history-page__list">
          {meals.map((meal) => (
            <Link to={`/meals/${meal.id}`} key={meal.id} className="card history-card">
              <img src={meal.imageUrl} alt="" className="history-card__thumb" />
              <div className="history-card__body">
                <p className="history-card__name">{meal.name || mealTypeFromTime(meal.loggedAt)}</p>
                <p className="history-card__meta">
                  {relativeDayLabel(meal.loggedAt)},{' '}
                  {new Date(meal.loggedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="mono-num history-card__macros">
                  <span style={{ color: 'var(--color-primary)' }}>{Math.round(meal.totalCalories)} kcal</span>
                  {' · '}
                  <span style={{ color: 'var(--macro-protein)' }}>{Math.round(meal.totalProteinG)}g P</span>
                  {' · '}
                  <span style={{ color: 'var(--macro-carbs)' }}>{Math.round(meal.totalCarbsG)}g C</span>
                  {' · '}
                  <span style={{ color: 'var(--macro-fats)' }}>{Math.round(meal.totalFatG)}g G</span>
                </p>
              </div>
              <ChevronRight size={18} className="history-card__chevron" />
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .history-page { padding: 32px 24px 64px; }
        .history-page__header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 22px; gap: 16px; flex-wrap: wrap;
        }
        .history-page__header h1 { margin: 0; }
        .history-page__controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .history-page__month {
          display: flex; align-items: center; gap: 4px;
          background: var(--color-surface); border: 1px solid var(--color-line);
          border-radius: 999px; padding: 6px 6px 6px 14px;
        }
        .history-page__month span {
          display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 0.88rem;
          padding: 0 6px; white-space: nowrap;
        }
        .history-page__month button {
          width: 26px; height: 26px; border-radius: 50%; border: none; background: transparent;
          color: var(--color-ink-soft); display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .history-page__month button:hover { background: var(--color-bg); color: var(--color-ink); }

        .history-page__empty {
          padding: 40px; text-align: center; display: flex; flex-direction: column; gap: 14px; align-items: center;
        }

        .history-page__list { display: flex; flex-direction: column; gap: 12px; }
        .history-card {
          display: flex; align-items: center; gap: 16px; padding: 14px;
          text-decoration: none; color: var(--color-ink); transition: border-color 0.15s ease;
        }
        .history-card:hover { border-color: var(--color-primary); }
        .history-card__thumb { width: 64px; height: 64px; border-radius: var(--radius-md); object-fit: cover; flex-shrink: 0; }
        .history-card__body { flex: 1; min-width: 0; }
        .history-card__name { margin: 0 0 2px; font-weight: 700; font-size: 0.98rem; }
        .history-card__meta { margin: 0 0 8px; font-size: 0.85rem; color: var(--color-ink-soft); }
        .history-card__macros { margin: 0; font-size: 0.85rem; font-weight: 600; }
        .history-card__chevron { color: var(--color-ink-soft); flex-shrink: 0; }
      `}
      </style>
    </div>
  );
}

function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function relativeDayLabel(isoDate) {
  const d = new Date(isoDate);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(todayOnly);
  yesterdayOnly.setDate(yesterdayOnly.getDate() - 1);

  if (dOnly.getTime() === todayOnly.getTime()) return 'Hoy';
  if (dOnly.getTime() === yesterdayOnly.getTime()) return 'Ayer';
  return capitalize(d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }));
}

// Mismo criterio que en el Dashboard: si el plato no tiene nombre propio,
// se aproxima uno a partir de la hora real en que se registró.
function mealTypeFromTime(isoDate) {
  const hour = new Date(isoDate).getHours();
  if (hour < 11) return 'Desayuno';
  if (hour < 16) return 'Almuerzo';
  if (hour < 19) return 'Merienda';
  return 'Cena';
}

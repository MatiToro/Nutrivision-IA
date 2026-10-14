import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ChevronLeft, ChevronRight, History as HistoryIcon } from 'lucide-react';
import apiClient from '../api/client';
import { EmptyState, Message, PageTitle } from '../components/ui';
import { addDays, longDate, mondayOf, sameDay, shortDay, startOfDay } from '../utils/dates';

/**
 * Historial de comidas por día, igual que en la app mobile: semana con
 * selector de días y los totales del día elegido.
 */
export default function HistoryPage() {
  const today = startOfDay(new Date());
  const [selected, setSelected] = useState(today);
  const [byWeek, setByWeek] = useState({});
  const [error, setError] = useState(null);

  const weekKey = mondayOf(selected).toISOString();
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(weekKey), i)), [weekKey]);

  const loadWeek = useCallback(async (key) => {
    const from = new Date(key);
    const to = addDays(from, 7);
    to.setMilliseconds(-1);
    try {
      const { data } = await apiClient.get(`/history/meals?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
      setByWeek((prev) => ({ ...prev, [key]: data.meals }));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadWeek(weekKey); }, [weekKey, loadWeek]);

  const meals = byWeek[weekKey] ?? [];
  const loading = byWeek[weekKey] === undefined && !error;
  const dayMeals = meals.filter((m) => sameDay(new Date(m.loggedAt), selected));
  const totals = dayMeals.reduce((a, m) => ({
    kcal: a.kcal + (m.totalCalories || 0),
    p: a.p + (m.totalProteinG || 0),
    c: a.c + (m.totalCarbsG || 0),
    f: a.f + (m.totalFatG || 0),
  }), { kcal: 0, p: 0, c: 0, f: 0 });
  const hasMeals = (d) => meals.some((m) => sameDay(new Date(m.loggedAt), d));
  const isToday = sameDay(selected, today);

  const summary = [
    { label: 'kcal', value: totals.kcal, color: 'var(--color-primary)' },
    { label: 'Proteínas', value: totals.p, color: 'var(--macro-protein)', unit: 'g' },
    { label: 'Carbs', value: totals.c, color: 'var(--macro-carbs)', unit: 'g' },
    { label: 'Grasas', value: totals.f, color: 'var(--macro-fats)', unit: 'g' },
  ];

  return (
    <div className="page page--narrow history-page">
      <PageTitle
        title="Historial"
        subtitle="Revisá lo que comiste día a día."
        right={(
          <Link to="/scan" className="btn btn-primary">
            <Camera size={17} /> Escanear plato
          </Link>
        )}
      />

      <div className="card history-page__week">
        <div className="history-page__week-nav">
          <button type="button" className="icon-btn" onClick={() => setSelected(addDays(selected, -7))} aria-label="Semana anterior">
            <ChevronLeft size={20} />
          </button>
          <span className="history-page__week-label">{longDate(selected)}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSelected(new Date(Math.min(addDays(selected, 7).getTime(), today.getTime())))}
            disabled={isToday}
            aria-label="Semana siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="history-page__days">
          {week.map((d) => {
            const future = d > today;
            const active = sameDay(d, selected);
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={future}
                onClick={() => setSelected(d)}
                className={`history-page__day-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                aria-label={longDate(d)}
              >
                <span className="history-page__day-letter">{shortDay(d)}</span>
                <span className="history-page__day-num">{d.getDate()}</span>
                <span className={`history-page__day-dot${hasMeals(d) ? ' has-meals' : ''}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="history-page__summary">
        {summary.map((s) => (
          <div key={s.label} className="history-page__summary-item">
            <strong style={{ color: s.color }}>{Math.round(s.value)}{s.unit ?? ''}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {error && <Message>{error}</Message>}

      <div className="card history-page__meals">
        {loading ? (
          <p className="hint" style={{ textAlign: 'center', padding: '20px 0' }}>Cargando…</p>
        ) : dayMeals.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon size={24} />}
            title={isToday ? 'Sin comidas registradas hoy' : 'Sin comidas este día'}
            text="Cada plato que escanees y guardes aparecerá acá con su foto, calorías y macros."
          >
            {isToday ? <Link to="/scan" className="btn btn-primary" style={{ marginTop: 14 }}>Escanear un plato</Link> : null}
          </EmptyState>
        ) : (
          dayMeals.map((meal) => (
            <Link to={`/meals/${meal.id}`} key={meal.id} className="meal-row">
              {meal.imageUrl ? <img src={meal.imageUrl} alt="" className="meal-row__thumb history-page__thumb" /> : null}
              <span className="meal-row__body">
                <span className="meal-row__name">{meal.name || mealTypeFromTime(meal.loggedAt)}</span>
                <span className="history-page__time">
                  {new Date(meal.loggedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} h
                </span>
                <span className="meal-row__meta">
                  <span style={{ color: 'var(--macro-protein)' }}>P {Math.round(meal.totalProteinG)}g</span>
                  {' · '}
                  <span style={{ color: 'var(--macro-carbs)' }}>C {Math.round(meal.totalCarbsG)}g</span>
                  {' · '}
                  <span style={{ color: 'var(--macro-fats)' }}>G {Math.round(meal.totalFatG)}g</span>
                </span>
              </span>
              <span className="meal-row__kcal">{Math.round(meal.totalCalories)} kcal</span>
              <ChevronRight size={16} className="meal-row__chevron" />
            </Link>
          ))
        )}
      </div>

      <style>{`
        .history-page__week { display: flex; flex-direction: column; gap: 14px; }
        .history-page__week-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .history-page__week-nav .icon-btn { background: var(--color-bg); box-shadow: none; }
        .history-page__week-nav .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .history-page__week-label { font-weight: 800; font-size: 1rem; text-align: center; }
        .history-page__days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .history-page__day-btn {
          display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 0;
          border-radius: var(--radius-md); border: none; background: transparent; cursor: pointer;
          transition: background 0.12s ease;
        }
        .history-page__day-btn:hover:not(:disabled):not(.is-active) { background: var(--color-bg); }
        .history-page__day-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .history-page__day-btn.is-active { background: var(--color-primary); }
        .history-page__day-letter { font-size: 0.72rem; font-weight: 700; color: var(--color-ink-soft); }
        .history-page__day-num { font-size: 1.05rem; font-weight: 800; color: var(--color-ink); }
        .history-page__day-btn.is-active .history-page__day-letter,
        .history-page__day-btn.is-active .history-page__day-num { color: #fff; }
        .history-page__day-dot { width: 5px; height: 5px; border-radius: 50%; background: transparent; }
        .history-page__day-dot.has-meals { background: var(--color-primary); }
        .history-page__day-btn.is-active .history-page__day-dot.has-meals { background: #fff; }
        .history-page__summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .history-page__summary-item {
          background: var(--color-surface); border-radius: var(--radius-md); padding: 12px 4px; text-align: center; box-shadow: var(--shadow-card);
        }
        .history-page__summary-item strong { display: block; font-size: 1.2rem; font-weight: 800; }
        .history-page__summary-item span { display: block; font-size: 0.74rem; color: var(--color-ink-soft); font-weight: 600; margin-top: 2px; }
        .history-page__meals { padding: 8px 14px; }
        .history-page__thumb { width: 56px; height: 56px; border-radius: 14px; }
        .history-page__time { display: block; font-size: 0.78rem; color: var(--color-ink-soft); font-weight: 600; }
      `}
      </style>
    </div>
  );
}

// Si el plato no tiene nombre propio, se aproxima uno a partir de la hora en que se registró.
function mealTypeFromTime(isoDate) {
  const hour = new Date(isoDate).getHours();
  if (hour < 11) return 'Desayuno';
  if (hour < 16) return 'Almuerzo';
  if (hour < 19) return 'Merienda';
  return 'Cena';
}

import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, RotateCcw } from "lucide-react";
import apiClient from "../api/client";
import LoadingScreen from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { CoachCard, MacroTotals, Message, PageTitle } from "../components/ui";

// Porciones al repetir una comida (1 = igual que la original).
const PORTIONS = [
  { value: 0.5, label: "½" },
  { value: 1, label: "1" },
  { value: 1.5, label: "1½" },
  { value: 2, label: "2" },
];

export default function MealResultPage() {
  // `patientId`: el nutricionista abre un plato de uno de sus pacientes.
  const { id, patientId } = useParams();
  const navigate = useNavigate();
  const { refreshStreak } = useAuth();
  // ?repetir=1 (desde el escáner): la opción "Registrar de nuevo" aparece arriba.
  const [searchParams] = useSearchParams();
  const repeatFirst = searchParams.get("repetir") === "1";
  const [meal, setMeal] = useState(null);
  const [viewerIsPremium, setViewerIsPremium] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portions, setPortions] = useState(1);
  const [repeating, setRepeating] = useState(false);
  const [repeatError, setRepeatError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get(patientId ? `/nutritionist/patients/${patientId}/meals/${id}` : `/meals/${id}`);
        setMeal(data.meal);
        setViewerIsPremium(data.viewerIsPremium !== false);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, patientId]);

  // "Registrar de nuevo": copia el plato al día de hoy. No gasta escaneos.
  async function repeatMeal() {
    setRepeating(true);
    setRepeatError(null);
    try {
      const { data } = await apiClient.post(`/meals/${id}/repeat`, { portions }, { timeout: 60000 });
      await refreshStreak();
      navigate(`/meals/${data.meal.id}`, { replace: true });
    } catch (err) {
      setRepeatError(err.message);
    } finally {
      setRepeating(false);
    }
  }

  if (loading) return <LoadingScreen label="Cargando el plato…" />;

  const backButton = (
    <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">
      <ArrowLeft size={20} />
    </button>
  );

  if (error) {
    return (
      <div className="page page--narrow">
        <PageTitle title={patientId ? "Plato del paciente" : "Detalle del plato"} back={backButton} />
        <Message>{error}</Message>
      </div>
    );
  }
  if (!meal) return null;

  const date = new Date(meal.loggedAt);
  const repeatCard = patientId ? null : (
    <section className="card meal-repeat">
      <div className="meal-repeat__head">
        <span className="icon-tile"><RotateCcw size={18} /></span>
        <div>
          <h3>¿Lo volviste a comer?</h3>
          <p className="hint">Registralo hoy sin sacar foto: no gasta escaneos.</p>
        </div>
      </div>
      <div className="chip-group" role="radiogroup" aria-label="Porciones">
        {PORTIONS.map((p) => (
          <button
            type="button" key={p.value} role="radio" aria-checked={portions === p.value}
            className={`chip${portions === p.value ? " is-active" : ""}`}
            onClick={() => setPortions(p.value)}
          >
            {p.label} {p.value === 1 ? "porción" : "porc."}
          </button>
        ))}
      </div>
      <p className="hint">
        {Math.round((meal.totalCalories || 0) * portions)} kcal · {Math.round((meal.totalProteinG || 0) * portions)} g de proteína
      </p>
      {repeatError ? <Message>{repeatError}</Message> : null}
      <button type="button" className="btn btn-primary" onClick={repeatMeal} disabled={repeating}>
        <RotateCcw size={16} /> {repeating ? "Registrando…" : "Registrar de nuevo hoy"}
      </button>
    </section>
  );
  const dateLabel = `${capitalize(
    date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }),
  )}, ${date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} h`;

  return (
    <div className="page meal-detail">
      <PageTitle title={patientId ? "Plato del paciente" : "Detalle del plato"} back={backButton} />

      <div className="meal-detail__grid">
        <section className="card card--flush meal-detail__summary">
          {meal.imageUrl ? (
            <img src={meal.imageUrl} alt={meal.name || "Plato registrado"} className="meal-detail__photo" />
          ) : null}
          <div className="meal-detail__summary-body">
            <div>
              <h2>{meal.name || "Plato registrado"}</h2>
              <span className="meal-detail__date">
                <CalendarClock size={14} /> {dateLabel}{meal.source === "REPEAT" ? " · Repetida" : ""}
              </span>
            </div>
            <MacroTotals
              calories={meal.totalCalories}
              proteinG={meal.totalProteinG}
              carbsG={meal.totalCarbsG}
              fatG={meal.totalFatG}
            />
          </div>
        </section>

        <div className="meal-detail__main">
          {repeatFirst ? repeatCard : null}
          <section className="card">
            <div className="section-header"><h3>Ingredientes estimados</h3></div>
            {meal.ingredients.length === 0 ? (
              <p className="hint">Sin ingredientes cargados.</p>
            ) : (
              meal.ingredients.map((ing) => (
                <div className="ingredient-row" key={ing.id}>
                  <div className="ingredient-row__top">
                    <span className="ingredient-row__name">{ing.name}</span>
                    <span className="ingredient-row__grams">{Math.round(ing.grams)} g</span>
                  </div>
                  <span className="ingredient-row__macros">
                    <span style={{ color: "var(--color-primary)" }}>{Math.round(ing.calories)} kcal</span>
                    {" · "}
                    <span style={{ color: "var(--macro-protein)" }}>{Math.round(ing.proteinG)}g P</span>
                    {" · "}
                    <span style={{ color: "var(--macro-carbs)" }}>{Math.round(ing.carbsG)}g C</span>
                    {" · "}
                    <span style={{ color: "var(--macro-fats)" }}>{Math.round(ing.fatG)}g G</span>
                  </span>
                </div>
              ))
            )}
          </section>

          <CoachCard feedback={meal.coachFeedback} upsell={!patientId && !viewerIsPremium} />
          {!repeatFirst ? repeatCard : null}
        </div>
      </div>

      <style>
        {`
        .meal-detail__grid { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 20px; align-items: start; }
        @media (max-width: 960px) { .meal-detail__grid { grid-template-columns: 1fr; gap: 16px; } }
        .meal-detail__summary { position: sticky; top: 24px; }
        @media (max-width: 960px) { .meal-detail__summary { position: static; } }
        .meal-detail__photo { width: 100%; height: 280px; object-fit: cover; display: block; background: var(--color-bg); }
        @media (max-width: 600px) { .meal-detail__photo { height: 220px; } }
        .meal-detail__summary-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .meal-detail__summary-body h2 { margin: 0 0 4px; font-size: 1.3rem; }
        .meal-detail__date { display: inline-flex; align-items: center; gap: 6px; color: var(--color-ink-soft); font-size: 0.85rem; font-weight: 600; }
        .meal-detail__main { display: flex; flex-direction: column; gap: 16px; }
        .meal-repeat { display: flex; flex-direction: column; gap: 12px; }
        .meal-repeat__head { display: flex; align-items: center; gap: 12px; }
        .meal-repeat__head h3 { margin: 0; font-size: 1rem; }
        .meal-repeat__head .hint { margin: 2px 0 0; }
        .meal-repeat > .hint { margin: 0; }
        .meal-repeat .chip-group { flex-wrap: wrap; }
        .meal-repeat .btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; }
      `}
      </style>
    </div>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

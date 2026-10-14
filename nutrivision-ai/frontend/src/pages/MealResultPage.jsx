import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock } from "lucide-react";
import apiClient from "../api/client";
import LoadingScreen from "../components/LoadingScreen";
import { CoachCard, MacroTotals, Message, PageTitle } from "../components/ui";

export default function MealResultPage() {
  // `patientId`: el nutricionista abre un plato de uno de sus pacientes.
  const { id, patientId } = useParams();
  const navigate = useNavigate();
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get(patientId ? `/nutritionist/patients/${patientId}/meals/${id}` : `/meals/${id}`);
        setMeal(data.meal);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, patientId]);

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
              <span className="meal-detail__date"><CalendarClock size={14} /> {dateLabel}</span>
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

          <CoachCard feedback={meal.coachFeedback} />
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
      `}
      </style>
    </div>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

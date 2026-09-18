import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import apiClient from "../api/client";
import LoadingScreen from "../components/LoadingScreen";

export default function MealResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get(`/meals/${id}`);
        setMeal(data.meal);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingScreen label="Cargando el plato…" />;
  if (error)
    return (
      <p className="container field-error" style={{ padding: 40 }}>
        {error}
      </p>
    );
  if (!meal) return null;

  const feedback = meal.coachFeedback;

  return (
    <div className="container meal-detail">
      <button
        type="button"
        className="meal-detail__back"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="meal-detail__top">
        <div className="meal-detail__image-wrap">
          <img src={meal.imageUrl} alt={meal.name || "Plato registrado"} />
          <span className="meal-detail__ai-badge">
            <Sparkles size={15} />
          </span>
        </div>

        <div className="meal-detail__top-info">
          <h1>{meal.name || "Plato registrado"}</h1>
          <span className="meal-detail__date-pill">
            {capitalize(
              new Date(meal.loggedAt).toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }),
            )}
            {", "}
            {new Date(meal.loggedAt).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          <div className="meal-detail__macros">
            <div className="meal-detail__macro">
              <span
                className="meal-detail__macro-value"
                style={{ color: "var(--color-primary)" }}
              >
                {Math.round(meal.totalCalories)} kcal
              </span>
              <span className="helper-text">Calorías</span>
            </div>
            <div className="meal-detail__macro">
              <span
                className="meal-detail__macro-value"
                style={{ color: "var(--macro-protein)" }}
              >
                {Math.round(meal.totalProteinG)} g
              </span>
              <span className="helper-text">Proteínas</span>
            </div>
            <div className="meal-detail__macro">
              <span
                className="meal-detail__macro-value"
                style={{ color: "var(--macro-carbs)" }}
              >
                {Math.round(meal.totalCarbsG)} g
              </span>
              <span className="helper-text">Carbohidratos</span>
            </div>
            <div className="meal-detail__macro">
              <span
                className="meal-detail__macro-value"
                style={{ color: "var(--macro-fats)" }}
              >
                {Math.round(meal.totalFatG)} g
              </span>
              <span className="helper-text">Grasas</span>
            </div>
          </div>
        </div>
      </div>

      <section className="card meal-detail__ingredients">
        <h3>Ingredientes estimados</h3>
        <div className="meal-detail__ingredient-list">
          {meal.ingredients.map((ing) => (
            <div className="meal-detail__ingredient-row" key={ing.id}>
              <span className="meal-detail__ingredient-name">
                {ing.name}{" "}
                <span className="helper-text">({Math.round(ing.grams)} g)</span>
              </span>
              <span className="meal-detail__ingredient-macros">
                <span style={{ color: "var(--color-primary)" }}>
                  {Math.round(ing.calories)} kcal
                </span>
                <span style={{ color: "var(--macro-protein)" }}>
                  {Math.round(ing.proteinG)}g P
                </span>
                <span style={{ color: "var(--macro-carbs)" }}>
                  {Math.round(ing.carbsG)}g C
                </span>
                <span style={{ color: "var(--macro-fats)" }}>
                  {Math.round(ing.fatG)}g G
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {feedback && (
        <section className="meal-detail__coach">
          <span className="meal-detail__coach-icon">
            <Sparkles size={19} color="#fff" />
          </span>
          <div>
            <h3>Coach IA</h3>
            <p>{feedback.summary}</p>
            {feedback.tips?.length > 0 && (
              <ul className="meal-detail__coach-tips">
                {feedback.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <style>
        {`
        .meal-detail { padding: 32px 24px 64px; max-width: 960px; }

        .meal-detail__back {
          display: inline-flex; align-items: center; gap: 8px; background: none; border: none;
          color: var(--color-ink-soft); font-weight: 600; font-size: 0.92rem; cursor: pointer;
          padding: 0; margin-bottom: 20px;
        }
        .meal-detail__back:hover { color: var(--color-ink); }

        .meal-detail__top { display: grid; grid-template-columns: 340px 1fr; gap: 28px; margin-bottom: 26px; align-items: start; }
        @media (max-width: 820px) { .meal-detail__top { grid-template-columns: 1fr; } }

        .meal-detail__image-wrap { position: relative; }
        .meal-detail__image-wrap img { width: 100%; height: 70%; min-height: 260px; object-fit: cover; border-radius: var(--radius-lg); display: block; }
        .meal-detail__ai-badge {
          position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; border-radius: 50%;
          background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .meal-detail__top-info { display: flex; flex-direction: column; justify-content: start;}
        .meal-detail__top-info h1 { margin: 0; font-size: 1.7rem; }
        .meal-detail__date-pill {
          align-self: flex-start; background: var(--color-bg); color: var(--color-ink-soft);
          font-size: 0.82rem; font-weight: 600; border-radius: 999px; margin-bottom: 20px
        }

        .meal-detail__macros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 6px; }
        .meal-detail__macro {
          background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md);
          padding: 14px 10px; text-align: center; display: flex; flex-direction: column; gap: 4px;
        }
        .meal-detail__macro-value { font-weight: 700; font-size: 1.05rem; }
        @media (max-width: 520px) { .meal-detail__macros { grid-template-columns: 1fr 1fr; } }

        .meal-detail__ingredients { padding: 22px; margin-bottom: 20px; }
        .meal-detail__ingredients h3 { margin: 0 0 14px; font-size: 1.1rem; }
        .meal-detail__ingredient-list { display: flex; flex-direction: column; }
        .meal-detail__ingredient-row {
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          padding: 13px 0; border-bottom: 1px solid var(--color-line); flex-wrap: wrap;
        }
        .meal-detail__ingredient-row:last-child { border-bottom: none; }
        .meal-detail__ingredient-name { font-weight: 600; font-size: 0.92rem; }
        .meal-detail__ingredient-macros { display: flex; gap: 14px; font-size: 0.82rem; font-weight: 600; }

        .meal-detail__coach {
          display: flex; gap: 12px; background: var(--color-primary-soft); border: 1px solid var(--color-primary);
          border-radius: var(--radius-lg); padding: 18px 20px;
        }
        .meal-detail__coach-icon {
          width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--gradient-primary);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .meal-detail__coach h3 { margin: 0 0 6px; font-size: 1rem; }
        .meal-detail__coach p { margin: 0 0 8px; font-size: 0.92rem; }
        .meal-detail__coach-tips { margin: 0; padding-left: 18px; font-size: 0.86rem; color: var(--color-ink-soft); }
        .meal-detail__coach-tips li { margin-bottom: 3px; }
      `}
      </style>
    </div>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

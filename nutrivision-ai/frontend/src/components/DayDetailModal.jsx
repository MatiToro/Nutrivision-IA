import { X } from 'lucide-react';
import MacroBar from './MacroBar';
import Portal from './Portal';

export default function DayDetailModal({ day, goal, onClose }) {
  if (!day) return null;

  return (
    <Portal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel day-modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-modal__header">
          <div>
            <h3>{day.fullDate}</h3>
            <span className="badge">{day.pct}% del objetivo diario</span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="day-modal__body">
          <div className="day-modal__section">
            <h4>Macros consumidos</h4>
            <div className="day-modal__macros">
              <MacroBar label="Calorías" value={day.totals.calories} goal={goal.calories} color="var(--color-primary)" unit=" kcal" />
              <MacroBar label="Proteínas" value={day.totals.proteinG} goal={goal.proteinG} color="var(--macro-protein)" />
              <MacroBar label="Carbohidratos" value={day.totals.carbsG} goal={goal.carbsG} color="var(--macro-carbs)" />
              <MacroBar label="Grasas" value={day.totals.fatG} goal={goal.fatG} color="var(--macro-fats)" />
            </div>
          </div>

          <div>
            <h4>Comidas del día</h4>
            {day.meals.length === 0 ? (
              <p className="helper-text">No hay platos registrados este día.</p>
            ) : (
              <ul className="day-modal__meals">
                {day.meals.map((meal) => (
                  <li key={meal.id}>
                    {meal.imageUrl ? <img src={meal.imageUrl} alt="" className="meal-row__thumb" /> : null}
                    <div className="day-modal__meal-info">
                      <span className="day-modal__meal-name">
                        {meal.name || 'Comida'}
                        <small>
                          {' · '}
                          {new Date(meal.loggedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
                        </small>
                      </span>
                      <span className="day-modal__meal-macros">
                        <span style={{ color: 'var(--macro-protein)' }}>P {Math.round(meal.totalProteinG)}g</span>
                        {' · '}
                        <span style={{ color: 'var(--macro-carbs)' }}>C {Math.round(meal.totalCarbsG)}g</span>
                        {' · '}
                        <span style={{ color: 'var(--macro-fats)' }}>G {Math.round(meal.totalFatG)}g</span>
                      </span>
                    </div>
                    <span className="day-modal__meal-kcal">{Math.round(meal.totalCalories)} kcal</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .day-modal { max-width: 480px; }
        .day-modal__header {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          padding: 22px 22px 0;
        }
        .day-modal__header h3 { margin: 0 0 6px; font-size: 1.15rem; }
        .day-modal__body { padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 18px; }
        .day-modal__body h4 { margin: 0 0 10px; font-size: 0.95rem; font-weight: 800; }
        .day-modal__section { background: var(--color-bg); border-radius: var(--radius-lg); padding: 16px; }
        .day-modal__macros { display: flex; flex-direction: column; gap: 12px; }
        .day-modal__meals { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
        .day-modal__meals li {
          display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-line);
        }
        .day-modal__meals li:last-child { border-bottom: none; }
        .day-modal__meal-info { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
        .day-modal__meal-name { font-size: 0.9rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .day-modal__meal-name small { font-size: 0.8rem; font-weight: 600; color: var(--color-ink-soft); }
        .day-modal__meal-macros { font-size: 0.76rem; font-weight: 700; }
        .day-modal__meal-kcal { font-size: 0.88rem; font-weight: 800; flex-shrink: 0; }
      `}
      </style>
    </div>
    </Portal>
  );
}

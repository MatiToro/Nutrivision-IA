import { X } from 'lucide-react';
import MacroBar from './MacroBar';

export default function DayDetailModal({ day, goal, onClose }) {
  if (!day) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="day-modal__header">
          <div>
            <h3>{day.fullDate}</h3>
            <p className="helper-text">{day.pct}% del objetivo diario cumplido</p>
          </div>
          <button type="button" className="day-modal__close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="day-modal__body">
          <div>
            <h4 className="day-modal__section-title">Macros consumidos</h4>
            <div className="day-modal__macros">
              <MacroBar label="Calorías" value={day.totals.calories} goal={goal.calories} color="var(--color-primary)" unit=" kcal" />
              <MacroBar label="Proteínas" value={day.totals.proteinG} goal={goal.proteinG} color="var(--macro-protein)" />
              <MacroBar label="Carbohidratos" value={day.totals.carbsG} goal={goal.carbsG} color="var(--macro-carbs)" />
              <MacroBar label="Grasas" value={day.totals.fatG} goal={goal.fatG} color="var(--macro-fats)" />
            </div>
          </div>

          <div>
            <h4 className="day-modal__section-title">Comidas del día</h4>
            {day.meals.length === 0 ? (
              <p className="helper-text">No hay platos registrados este día.</p>
            ) : (
              <ul className="day-modal__meals">
                {day.meals.map((meal) => (
                  <li key={meal.id}>
                    <img src={meal.imageUrl} alt="" className="day-modal__meal-thumb" />
                    <div className="day-modal__meal-info">
                      <span className="day-modal__meal-time">
                        {new Date(meal.loggedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="day-modal__meal-macros">
                        <span style={{ color: 'var(--macro-protein)' }}>{Math.round(meal.totalProteinG)}g prot</span>
                        {' · '}
                        <span style={{ color: 'var(--macro-carbs)' }}>{Math.round(meal.totalCarbsG)}g carbs</span>
                        {' · '}
                        <span style={{ color: 'var(--macro-fats)' }}>{Math.round(meal.totalFatG)}g grasas</span>
                      </span>
                    </div>
                    <span className="mono-num day-modal__meal-kcal">{Math.round(meal.totalCalories)} kcal</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .day-modal__header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 22px 24px; border-bottom: 1px solid var(--color-line);
        }
        .day-modal__header h3 { margin: 0 0 2px; font-size: 1.15rem; }
        .day-modal__close {
          width: 32px; height: 32px; border-radius: 10px; border: none;
          background: var(--color-bg); display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
        }
        .day-modal__body { padding: 22px 24px; display: flex; flex-direction: column; gap: 22px; }
        .day-modal__section-title { margin: 0 0 12px; font-size: 0.9rem; font-weight: 700; }
        .day-modal__macros { display: flex; flex-direction: column; gap: 14px; }
        .day-modal__meals { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .day-modal__meals li {
          display: flex; align-items: center; gap: 12px; padding: 10px;
          background: var(--color-bg); border-radius: var(--radius-sm);
        }
        .day-modal__meal-thumb { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
        .day-modal__meal-info { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 2px; }
        .day-modal__meal-time { font-size: 0.82rem; font-weight: 600; }
        .day-modal__meal-macros { font-size: 0.76rem; color: var(--color-ink-soft); }
        .day-modal__meal-kcal { font-size: 0.85rem; font-weight: 700; }
      `}
      </style>
    </div>
  );
}

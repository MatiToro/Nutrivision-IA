import { Trash2, Plus } from 'lucide-react';

const EMPTY_INGREDIENT = { name: '', grams: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/**
 * Ajuste Manual de Ingredientes.
 *
 * Para ingredientes que vinieron del análisis de IA (o ya fueron editados
 * antes), solo se puede tocar el nombre y la cantidad en gramos — los
 * macros se recalculan solos, proporcionalmente, para que nunca queden
 * desactualizados respecto al peso real. No tiene sentido dejar "editar"
 * las calorías de un ingrediente detectado de forma libre: eso rompe la
 * relación real entre gramos y macros.
 *
 * Para ingredientes agregados a mano (no los detectó la IA, no hay un
 * valor de referencia), sí se puede cargar calorías y macros directamente,
 * porque no existe otro dato del que partir.
 */
export default function IngredientEditor({ ingredients, onChange, disabled }) {
  function updateName(index, value) {
    const next = [...ingredients];
    next[index] = { ...next[index], name: value, source: next[index].source || 'MANUAL_EDITED' };
    onChange(next);
  }

  function updateGrams(index, rawValue) {
    const next = [...ingredients];
    const prev = next[index];
    const newGrams = Number(rawValue);
    // Escala calorías y macros en proporción al cambio de peso, así los
    // números siguen siendo reales y no un valor "congelado" del escaneo.
    const ratio = prev.grams > 0 ? newGrams / prev.grams : 1;
    next[index] = {
      ...prev,
      grams: newGrams,
      calories: round1(prev.calories * ratio),
      proteinG: round1(prev.proteinG * ratio),
      carbsG: round1(prev.carbsG * ratio),
      fatG: round1(prev.fatG * ratio),
      source: prev.source || 'MANUAL_EDITED',
    };
    onChange(next);
  }

  function updateManualMacro(index, field, rawValue) {
    const next = [...ingredients];
    next[index] = { ...next[index], [field]: Number(rawValue) };
    onChange(next);
  }

  function removeIngredient(index) {
    onChange(ingredients.filter((_, i) => i !== index));
  }

  function addIngredient() {
    onChange([...ingredients, { ...EMPTY_INGREDIENT, source: 'MANUAL_ADDED' }]);
  }

  return (
    <div className="ingredient-editor">
      <table className="ingredient-editor__table">
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th>Cantidad</th>
            <th>Macros</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ing, index) => {
            const isManual = ing.source === 'MANUAL_ADDED';
            return (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={index}>
                <td>
                  <input
                    aria-label="Nombre del ingrediente"
                    value={ing.name}
                    disabled={disabled}
                    onChange={(e) => updateName(index, e.target.value)}
                    maxLength={120}
                  />
                </td>
                <td className="ingredient-editor__grams-cell">
                  <input
                    aria-label="Cantidad en gramos"
                    type="number"
                    min="0"
                    step="1"
                    className="mono-num"
                    value={ing.grams}
                    disabled={disabled}
                    onChange={(e) => updateGrams(index, e.target.value)}
                  />
                  <span className="helper-text">g</span>
                </td>
                <td>
                  {isManual ? (
                    <div className="ingredient-editor__manual-macros">
                      {[
                        { field: 'calories', label: 'kcal' },
                        { field: 'proteinG', label: 'P' },
                        { field: 'carbsG', label: 'C' },
                        { field: 'fatG', label: 'G' },
                      ].map(({ field, label }) => (
                        <label key={field} className="ingredient-editor__manual-macro">
                          <input
                            aria-label={label}
                            type="number"
                            min="0"
                            step="0.1"
                            className="mono-num"
                            value={ing[field]}
                            disabled={disabled}
                            onChange={(e) => updateManualMacro(index, field, e.target.value)}
                          />
                          <span className="helper-text">{label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="ingredient-editor__macros-readonly mono-num">
                      {Math.round(ing.calories)} kcal · {Math.round(ing.proteinG)}g P · {Math.round(ing.carbsG)}g C · {Math.round(ing.fatG)}g G
                    </span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="ingredient-editor__remove"
                    onClick={() => removeIngredient(index)}
                    disabled={disabled}
                    aria-label={`Eliminar ${ing.name || 'ingrediente'}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button type="button" className="btn btn-ghost" onClick={addIngredient} disabled={disabled}>
        <Plus size={16} /> Agregar ingrediente
      </button>

      <style>{`
        .ingredient-editor__table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 0.88rem;
        }
        .ingredient-editor__table th {
          text-align: left;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-ink-soft);
          padding: 6px 8px;
          border-bottom: 1.5px solid var(--color-line);
        }
        .ingredient-editor__table td {
          padding: 6px 8px;
          border-bottom: 1px solid var(--color-line);
          vertical-align: middle;
        }
        .ingredient-editor__table input {
          border: 1px solid transparent;
          border-radius: 6px;
          padding: 6px 7px;
          background: transparent;
        }
        .ingredient-editor__table > table input,
        .ingredient-editor__table td > input {
          width: 100%;
        }
        .ingredient-editor__table input:hover:not(:disabled) { border-color: var(--color-line); }
        .ingredient-editor__table input:focus { border-color: var(--color-primary); background: var(--color-surface); }
        .ingredient-editor__grams-cell { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .ingredient-editor__grams-cell input { width: 70px; }
        .ingredient-editor__macros-readonly { color: var(--color-ink-soft); white-space: nowrap; }
        .ingredient-editor__manual-macros { display: flex; gap: 8px; flex-wrap: wrap; }
        .ingredient-editor__manual-macro { display: flex; align-items: center; gap: 4px; }
        .ingredient-editor__manual-macro input { width: 56px; }
        .ingredient-editor__remove {
          border: none;
          background: transparent;
          color: var(--color-danger);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
        }
        .ingredient-editor__remove:hover:not(:disabled) { background: var(--color-berry-soft); }
      `}
      </style>
    </div>
  );
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

import { Trash2, Plus, Loader2, RotateCcw } from 'lucide-react';
import apiClient from '../api/client';
import {
  newUid, round1, scaleFromBasis, refreshBasis,
} from '../utils/ingredients';

const EMPTY_INGREDIENT = { name: '', grams: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/**
 * Ajuste Manual de Ingredientes.
 *
 * Ingredientes que vinieron del análisis de IA (o ya editados antes):
 *  - Cantidad en gramos: los macros se recalculan solos, en proporción,
 *    a partir de los valores de referencia del ingrediente (_basis). Así
 *    poner 0 g y después volver a subirlo recupera los valores correctos.
 *  - Nombre: si el usuario lo corrige (ej. "milanesa de carne" → "milanesa
 *    de pollo"), al salir del campo se le piden a la IA los macros del
 *    ingrediente nuevo, porque no es el mismo alimento.
 *  - No se pueden editar calorías/macros a mano: eso rompería la relación
 *    real entre alimento, gramos y macros.
 *
 * Ingredientes agregados a mano (MANUAL_ADDED): no hay un valor de
 * referencia del que partir, así que se cargan calorías y macros directo.
 *
 * `onChange` recibe una función (prev => next) para que las respuestas
 * asíncronas de la IA se apliquen sobre el estado más reciente.
 */
export default function IngredientEditor({ ingredients, onChange, disabled }) {
  function updateByUid(uid, updater) {
    onChange((prev) => prev.map((ing) => (ing._uid === uid ? updater(ing) : ing)));
  }

  function updateName(uid, value) {
    updateByUid(uid, (ing) => ({
      ...ing,
      name: value,
      source: ing.source || 'MANUAL_EDITED',
      // Si vuelve al nombre original, se descarta un error previo.
      ...(value.trim() === ing._refName ? { _lookup: undefined, _lookupError: undefined } : {}),
    }));
  }

  function updateGrams(uid, rawValue) {
    const newGrams = Math.max(0, Number(rawValue) || 0);
    updateByUid(uid, (ing) => {
      const scaled = scaleFromBasis(ing._basis, newGrams);
      return {
        ...ing,
        grams: newGrams,
        // Sin referencia (ingrediente manual en 0 g) no hay de dónde escalar:
        // se dejan los macros como están.
        ...scaled,
        source: ing.source || 'MANUAL_EDITED',
      };
    });
  }

  function updateManualMacro(uid, field, rawValue) {
    updateByUid(uid, (ing) => refreshBasis({ ...ing, [field]: Math.max(0, Number(rawValue) || 0) }));
  }

  // Pide a la IA los macros del ingrediente con su nombre nuevo.
  async function recalculateByName(uid) {
    const ing = ingredients.find((i) => i._uid === uid);
    if (!ing || ing.source === 'MANUAL_ADDED') return;
    const requestedName = ing.name.trim();
    if (requestedName.length < 2 || requestedName === ing._refName) return;

    updateByUid(uid, (i) => ({ ...i, _lookup: 'pending', _lookupError: undefined }));
    try {
      const { data } = await apiClient.post('/meals/ingredient-nutrition', {
        name: requestedName,
        grams: Number(ing.grams) || 0,
      }, { timeout: 45000 });
      const ref = data.ingredient;
      updateByUid(uid, (i) => {
        // Si mientras tanto el usuario volvió a cambiar el nombre, esta
        // respuesta ya no corresponde: la ignoramos.
        if (i.name.trim() !== requestedName) return { ...i, _lookup: undefined };
        const basis = {
          grams: ref.grams, calories: ref.calories, proteinG: ref.proteinG, carbsG: ref.carbsG, fatG: ref.fatG,
        };
        // Los gramos pueden haber cambiado durante la consulta: escalamos
        // la referencia a la cantidad actual.
        const scaled = scaleFromBasis(basis, i.grams) || {
          calories: 0, proteinG: 0, carbsG: 0, fatG: 0,
        };
        return {
          ...i,
          ...scaled,
          _basis: basis,
          _refName: requestedName,
          _lookup: undefined,
          _lookupError: undefined,
          source: 'MANUAL_EDITED',
          fatSecretFoodId: ref.fatSecretFoodId || null,
        };
      });
    } catch (err) {
      updateByUid(uid, (i) => (i.name.trim() === requestedName
        ? { ...i, _lookup: 'error', _lookupError: err.message }
        : { ...i, _lookup: undefined }));
    }
  }

  function removeIngredient(uid) {
    onChange((prev) => prev.filter((ing) => ing._uid !== uid));
  }

  function addIngredient() {
    onChange((prev) => [...prev, {
      ...EMPTY_INGREDIENT, source: 'MANUAL_ADDED', _uid: newUid(), _basis: null, _refName: '',
    }]);
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
          {ingredients.map((ing) => {
            const isManual = ing.source === 'MANUAL_ADDED';
            const pending = ing._lookup === 'pending';
            return (
              <tr key={ing._uid}>
                <td>
                  <input
                    aria-label="Nombre del ingrediente"
                    value={ing.name}
                    disabled={disabled}
                    onChange={(e) => updateName(ing._uid, e.target.value)}
                    onBlur={() => recalculateByName(ing._uid)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
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
                    disabled={disabled || pending}
                    onChange={(e) => updateGrams(ing._uid, e.target.value)}
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
                            onChange={(e) => updateManualMacro(ing._uid, field, e.target.value)}
                          />
                          <span className="helper-text">{label}</span>
                        </label>
                      ))}
                    </div>
                  ) : pending ? (
                    <span className="ingredient-editor__status">
                      <Loader2 size={14} className="ingredient-editor__spin" /> Recalculando con IA…
                    </span>
                  ) : (
                    <>
                      <span className="ingredient-editor__macros-readonly mono-num">
                        {Math.round(ing.calories)} kcal · {round1(ing.proteinG)}g P · {round1(ing.carbsG)}g C · {round1(ing.fatG)}g G
                      </span>
                      {ing._lookup === 'error' && (
                        <span className="ingredient-editor__error">
                          {ing._lookupError} Se mantienen los valores anteriores.{' '}
                          <button type="button" onClick={() => recalculateByName(ing._uid)} disabled={disabled}>
                            <RotateCcw size={12} /> Reintentar
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="ingredient-editor__remove"
                    onClick={() => removeIngredient(ing._uid)}
                    disabled={disabled || pending}
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

      <button type="button" className="btn btn-ghost ingredient-editor__add" onClick={addIngredient} disabled={disabled}>
        <Plus size={16} /> Agregar ingrediente
      </button>

      <style>{`
        .ingredient-editor { display: flex; flex-direction: column; gap: 12px; }
        .ingredient-editor__table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin: -8px 0 0; font-size: 0.9rem; }
        .ingredient-editor__table th {
          text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--color-ink-soft); padding: 0 8px;
        }
        .ingredient-editor__table td { padding: 8px; vertical-align: middle; background: var(--color-bg); }
        .ingredient-editor__table td:first-child { border-radius: var(--radius-md) 0 0 var(--radius-md); }
        .ingredient-editor__table td:last-child { border-radius: 0 var(--radius-md) var(--radius-md) 0; width: 1%; }
        .ingredient-editor__table input {
          border: 1.5px solid transparent; border-radius: 10px; padding: 8px 10px; background: var(--color-surface);
          font-weight: 600; color: var(--color-ink);
        }
        .ingredient-editor__table td > input { width: 100%; }
        .ingredient-editor__table input:hover:not(:disabled) { border-color: var(--color-line); }
        .ingredient-editor__table input:focus { border-color: var(--color-primary); outline: none; }
        .ingredient-editor__grams-cell { white-space: nowrap; }
        .ingredient-editor__table .ingredient-editor__grams-cell input { width: 76px; }
        .ingredient-editor__grams-cell .helper-text { margin-left: 6px; }
        .ingredient-editor__macros-readonly { color: var(--color-ink-soft); font-size: 0.82rem; font-weight: 700; white-space: nowrap; }
        .ingredient-editor__manual-macros { display: flex; gap: 8px; flex-wrap: wrap; }
        .ingredient-editor__manual-macro { display: flex; align-items: center; gap: 4px; }
        .ingredient-editor__manual-macro input { width: 60px; }
        .ingredient-editor__remove {
          border: none; background: var(--color-danger-soft); color: var(--color-danger); cursor: pointer;
          width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .ingredient-editor__remove:hover:not(:disabled) { background: #F8DCD8; }
        .ingredient-editor__remove:disabled { opacity: 0.4; cursor: not-allowed; }
        .ingredient-editor__status { display: inline-flex; align-items: center; gap: 6px; color: var(--color-primary); font-size: 0.82rem; font-weight: 700; }
        .ingredient-editor__spin { animation: ingredient-spin 0.9s linear infinite; }
        @keyframes ingredient-spin { to { transform: rotate(360deg); } }
        .ingredient-editor__error { display: block; margin-top: 4px; color: var(--color-danger); font-size: 0.78rem; }
        .ingredient-editor__error button {
          display: inline-flex; align-items: center; gap: 3px; border: none; background: none;
          color: var(--color-primary); font-weight: 700; cursor: pointer; padding: 0; font-size: 0.78rem;
        }
        .ingredient-editor__add { align-self: flex-start; }

        /* En pantallas chicas cada ingrediente se apila como una tarjeta */
        @media (max-width: 640px) {
          .ingredient-editor__table thead { display: none; }
          .ingredient-editor__table, .ingredient-editor__table tbody { display: block; margin: 0; }
          .ingredient-editor__table tr {
            display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
            background: var(--color-bg); border-radius: var(--radius-md); padding: 10px; margin-bottom: 8px;
          }
          .ingredient-editor__table td { display: block; padding: 0; background: none; border-radius: 0 !important; width: auto !important; }
          .ingredient-editor__table td:nth-child(1) { grid-column: 1 / 2; }
          .ingredient-editor__table td:nth-child(4) { grid-column: 2 / 3; grid-row: 1; }
          .ingredient-editor__table td:nth-child(2), .ingredient-editor__table td:nth-child(3) { grid-column: 1 / -1; }
          .ingredient-editor__macros-readonly { white-space: normal; }
        }
      `}
      </style>
    </div>
  );
}


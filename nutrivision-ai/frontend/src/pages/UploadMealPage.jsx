import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Pencil, X, Trash2, Plus, FileUp, Lightbulb, AlertTriangle, Camera,
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import IngredientEditor from '../components/IngredientEditor';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function UploadMealPage() {
  const navigate = useNavigate();
  const { refreshStreak } = useAuth();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  // Todo lo del análisis vive acá, en memoria, hasta que se confirma el
  // guardado — nada de esto toca la base de datos todavía.
  const [analysis, setAnalysis] = useState(null);

  const [plateName, setPlateName] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draftIngredients, setDraftIngredients] = useState([]);

  const analyze = useCallback(async (selectedFile) => {
    setAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      const { data } = await apiClient.post('/meals/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAnalysis(data);
    } catch (err) {
      setError(err.message);
      setPreviewUrl(null);
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const validateAndAnalyze = useCallback((selectedFile) => {
    setError(null);
    if (!selectedFile) return;
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) { setError('Formato no soportado. Usá JPG, PNG o WEBP.'); return; }
    if (selectedFile.size > MAX_BYTES) { setError('La imagen es muy pesada. El máximo es 5 MB.'); return; }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    analyze(selectedFile);
  }, [analyze]);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    validateAndAnalyze(e.dataTransfer.files?.[0]);
  }

  function resetScanner() {
    setFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setError(null);
    setPlateName('');
    setEditing(false);
  }

  function startEditing() {
    setDraftIngredients(analysis.ingredients.map((ing) => ({ ...ing })));
    setEditing(true);
  }

  function applyIngredientEdits() {
    setAnalysis((a) => ({ ...a, ingredients: draftIngredients, totals: sumIngredients(draftIngredients) }));
    setEditing(false);
  }

  async function handleConfirm() {
    if (!plateName.trim()) {
      setError('Ponele un nombre al plato antes de guardarlo.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', plateName.trim());
      formData.append('ingredients', JSON.stringify(analysis.ingredients));
      formData.append('coachFeedback', JSON.stringify(analysis.coachFeedback));
      await apiClient.post('/meals', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshStreak();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const totals = analysis?.totals;
  const feedback = analysis?.coachFeedback;
  const canConfirm = Boolean(plateName.trim()) && !saving;

  // ------- Estado inicial: todavía no se subió nada -------
  if (!analysis) {
    return (
      <div className="container scanner-page">
        <div className="scanner-page__intro">
          <h1>Escanear de Alimentos</h1>
          <p>Sacá una foto de tu plato y deja que la IA haga el resto.</p>
        </div>

        {error && <p className="field-error" style={{ marginBottom: 16 }}>{error}</p>}

        <div className="scanner-hero">
          <div
            className={`scanner-drop${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !analyzing && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !analyzing) inputRef.current?.click(); }}
          >
            <input
              ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} hidden
              onChange={(e) => validateAndAnalyze(e.target.files?.[0])}
            />

            {previewUrl ? (
              <div className="scanner-drop__analyzing">
                <img src={previewUrl} alt="Plato adjuntado" />
                <div className="scanner-drop__pulse">
                  <span className="scanner-drop__pulse-dot" />
                  <p>Analizando con IA…</p>
                </div>
              </div>
            ) : (
              <>
                <div className="scanner-drop__frame">
                  <span className="scanner-drop__corner scanner-drop__corner--tl" />
                  <span className="scanner-drop__corner scanner-drop__corner--tr" />
                  <span className="scanner-drop__corner scanner-drop__corner--bl" />
                  <span className="scanner-drop__corner scanner-drop__corner--br" />
                  <span className="scanner-drop__badge"><Camera size={28} /></span>
                </div>

                <h2>Toca para subir una foto</h2>
                <p className="scanner-drop__hint">o arrastrá la imagen aquí</p>

                <span className="scanner-drop__cta">
                  <FileUp size={18} /> Adjuntar archivo
                </span>
              </>
            )}
          </div>

          <div className="scanner-hero__art">
            <img src="/scanner-hero.jpg" alt="Teléfono escaneando un plato de comida" />
          </div>
        </div>

        <div className="scanner-tip">
          <span className="scanner-tip__icon"><Lightbulb size={22} /></span>
          <div>
            <h3>Consejo</h3>
            <p>Intentá que la foto sea clara y que se vea todo el plato.</p>
          </div>
        </div>

        <ScannerStyles />
      </div>
    );
  }

  // ------- Estado con análisis: resultados -------
  return (
    <div className="container scanner-page">
      <div className="scanner-page__intro">
        <h1>Escanear de Alimentos</h1>
        <p>Revisá lo que detectó la IA y guardá tu plato.</p>
      </div>

      {error && <p className="field-error" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="scanner-results-grid">
        <div>
          <div className="card scanner-summary">
            <img src={previewUrl} alt="Plato analizado" className="scanner-summary__image" />
            <div className="scanner-summary__body">
              <div className="scanner-summary__status">
                <span className="scanner-summary__status-dot" />
                <p>Análisis completado</p>
              </div>
              <div className="scanner-summary__macros">
                <div className="scanner-summary__macro">
                  <div className="mono-num" style={{ color: 'var(--color-primary)' }}>{Math.round(totals.totalCalories)}</div>
                  <div className="helper-text">kcal</div>
                </div>
                <div className="scanner-summary__macro">
                  <div className="mono-num" style={{ color: 'var(--macro-protein)' }}>{Math.round(totals.totalProteinG)}g</div>
                  <div className="helper-text">Prot</div>
                </div>
                <div className="scanner-summary__macro">
                  <div className="mono-num" style={{ color: 'var(--macro-carbs)' }}>{Math.round(totals.totalCarbsG)}g</div>
                  <div className="helper-text">Carbs</div>
                </div>
                <div className="scanner-summary__macro">
                  <div className="mono-num" style={{ color: 'var(--macro-fats)' }}>{Math.round(totals.totalFatG)}g</div>
                  <div className="helper-text">Grasas</div>
                </div>
              </div>
              <button type="button" className="scanner-summary__reset" onClick={resetScanner}>
                ← Escanear otro plato
              </button>
            </div>
          </div>
        </div>

        <div className="scanner-results">
          <section className="card scanner-ingredients">
            <div className="scanner-ingredients__header">
              <h2>Ingredientes detectados</h2>
              {!editing ? (
                <button type="button" className="scanner-ingredients__add" onClick={startEditing}>
                  <Plus size={15} /> Agregar
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                    <X size={15} /> Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={applyIngredientEdits}>Guardar</button>
                </div>
              )}
            </div>

            {editing ? (
              <IngredientEditor ingredients={draftIngredients} onChange={setDraftIngredients} disabled={false} />
            ) : (
              <div className="scanner-ingredients__list">
                {analysis.ingredients.map((ing, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div className="scanner-ingredient-row" key={index}>
                    <div className="scanner-ingredient-row__top">
                      <h4>{ing.name}</h4>
                      <div className="scanner-ingredient-row__actions">
                        <button type="button" onClick={startEditing} aria-label={`Editar ${ing.name}`}><Pencil size={14} /></button>
                        <button type="button" onClick={startEditing} aria-label={`Eliminar ${ing.name}`}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="scanner-ingredient-row__macros">
                      <span className="helper-text">{Math.round(ing.grams)}g</span>
                      <span style={{ color: 'var(--color-primary)' }}>{Math.round(ing.calories)} kcal</span>
                      <span style={{ color: 'var(--macro-protein)' }}>{Math.round(ing.proteinG)}g prot</span>
                      <span style={{ color: 'var(--macro-carbs)' }}>{Math.round(ing.carbsG)}g carbs</span>
                      <span style={{ color: 'var(--macro-fats)' }}>{Math.round(ing.fatG)}g grasas</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {feedback && (
            <>
              <p className="scanner-disclaimer">
                <AlertTriangle size={14} />
                El Coach IA da sugerencias generales, no reemplaza el consejo de un nutricionista u otro profesional de la salud.
              </p>
              <section className="scanner-coach">
                <span className="scanner-coach__icon"><Sparkles size={19} color="#fff" /></span>
                <div>
                  <h3>Coach IA</h3>
                  <p>{feedback.summary}</p>
                  {feedback.tips?.length > 0 && (
                    <ul className="scanner-coach__tips">
                      {feedback.tips.map((tip) => <li key={tip}>{tip}</li>)}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}

          <section className="card scanner-save">
            <label htmlFor="plateName">
              Nombre del plato <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="plateName" type="text" placeholder="Ej: Almuerzo fitness" maxLength={120} required
              value={plateName} onChange={(e) => setPlateName(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-block" onClick={handleConfirm} disabled={!canConfirm}>
              {saving ? 'Guardando…' : 'Agregar a comidas de hoy'}
            </button>
            <p className="helper-text" style={{ marginTop: 8, marginBottom: 0 }}>
              Este plato recién se guarda en tu historial cuando le ponés un nombre y confirmás acá.
            </p>
          </section>
        </div>
      </div>

      <ScannerStyles />
    </div>
  );
}

function ScannerStyles() {
  return (
    <style>{`
      .scanner-page { padding: 34px 24px 64px; }
      .scanner-page__intro { margin-bottom: 22px; }
      .scanner-page__intro h1 { margin: 0 0 4px; font-size: 2rem; letter-spacing: -0.02em; }
      .scanner-page__intro p { margin: 0; color: var(--color-ink-soft); font-size: 1rem; }

      /* ---- Estado inicial ---- */
      .scanner-hero { display: grid; grid-template-columns: 1.45fr 1fr; gap: 24px; align-items: stretch; }
      @media (max-width: 900px) { .scanner-hero { grid-template-columns: 1fr; } }

      .scanner-drop {
        border: 2px dashed #9FD4B4; border-radius: 18px; background: #F2FAF5;
        min-height: 420px; display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; cursor: pointer; padding: 32px; transition: border-color .15s ease, background .15s ease;
      }
      .scanner-drop.is-dragging { border-color: var(--color-primary); background: #E6F5EC; }
      .scanner-drop h2 { margin: 0 0 6px; font-size: 1.22rem; font-weight: 700; }
      .scanner-drop__hint { margin: 0 0 22px; color: var(--color-ink-soft); font-size: 0.95rem; }

      .scanner-drop__frame { position: relative; width: 150px; height: 118px; margin-bottom: 22px; }
      .scanner-drop__corner { position: absolute; width: 26px; height: 26px; border: 2.5px solid #4CAF7D; }
      .scanner-drop__corner--tl { top: 0; left: 0; border-right: none; border-bottom: none; border-radius: 6px 0 0 0; }
      .scanner-drop__corner--tr { top: 0; right: 0; border-left: none; border-bottom: none; border-radius: 0 6px 0 0; }
      .scanner-drop__corner--bl { bottom: 0; left: 0; border-right: none; border-top: none; border-radius: 0 0 0 6px; }
      .scanner-drop__corner--br { bottom: 0; right: 0; border-left: none; border-top: none; border-radius: 0 0 6px 0; }
      .scanner-drop__badge {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 66px; height: 66px; border-radius: 50%; background: #2E9E5B; color: #fff;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 22px rgba(46,158,91,0.3);
      }

      .scanner-drop__cta {
        display: inline-flex; align-items: center; gap: 10px;
        background: #1A8B4C; color: #fff; padding: 14px 34px; border-radius: 10px;
        font-weight: 700; font-size: 0.96rem;
      }
      .scanner-drop:hover .scanner-drop__cta { background: #14713D; }

      .scanner-drop__analyzing { display: flex; flex-direction: column; align-items: center; gap: 18px; }
      .scanner-drop__analyzing img {
        width: 210px; height: 210px; object-fit: cover; border-radius: 18px; box-shadow: var(--shadow-card);
      }
      .scanner-drop__pulse { display: flex; align-items: center; gap: 9px; color: var(--color-primary); }
      .scanner-drop__pulse p { margin: 0; font-weight: 700; font-size: 0.95rem; }
      .scanner-drop__pulse-dot {
        width: 9px; height: 9px; border-radius: 50%; background: var(--color-primary);
        animation: scanner-pulse 1.2s ease-in-out infinite;
      }
      @keyframes scanner-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

      .scanner-hero__art {
        border-radius: 18px; overflow: hidden; background: #F2FAF5;
        display: flex; align-items: center; justify-content: center;
      }
      .scanner-hero__art img { width: 100%; height: 100%; object-fit: cover; display: block; }

      .scanner-tip {
        display: flex; align-items: center; gap: 16px; margin-top: 24px;
        background: #F2FAF5; border-radius: 14px; padding: 20px 24px;
      }
      .scanner-tip__icon { color: #2E9E5B; flex-shrink: 0; display: flex; }
      .scanner-tip h3 { margin: 0 0 2px; font-size: 1rem; color: #1E7A46; }
      .scanner-tip p { margin: 0; color: var(--color-ink-soft); font-size: 0.92rem; }

      /* ---- Estado con resultados ---- */
      .scanner-results-grid { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 20px; align-items: start; }
      @media (max-width: 940px) { .scanner-results-grid { grid-template-columns: 1fr; } }

      .scanner-summary { display: flex; flex-direction: column; overflow: hidden; padding: 0; }
      .scanner-summary__image { width: 100%; height: 220px; object-fit: cover; }
      .scanner-summary__body { padding: 20px; display: flex; flex-direction: column; }
      .scanner-summary__status { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
      .scanner-summary__status p { margin: 0; font-weight: 700; font-size: 0.9rem; }
      .scanner-summary__status-dot {
        width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary);
        animation: scanner-pulse 1.6s ease-in-out infinite;
      }
      .scanner-summary__macros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
      .scanner-summary__macro { background: var(--color-bg); border-radius: var(--radius-sm); padding: 12px 6px; text-align: center; }
      .scanner-summary__macro .mono-num { font-weight: 700; font-size: 1.1rem; }
      .scanner-summary__reset { background: none; border: none; color: var(--color-ink-soft); font-size: 0.88rem; cursor: pointer; padding: 8px; }
      .scanner-summary__reset:hover { color: var(--color-ink); }

      .scanner-results { display: flex; flex-direction: column; gap: 18px; }
      .scanner-ingredients { padding: 22px; }
      .scanner-ingredients__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .scanner-ingredients__header h2 { margin: 0; font-size: 1.1rem; }
      .scanner-ingredients__add {
        display: inline-flex; align-items: center; gap: 6px; background: none; border: none;
        color: var(--color-primary); font-weight: 600; font-size: 0.88rem; cursor: pointer;
        padding: 6px 10px; border-radius: var(--radius-sm);
      }
      .scanner-ingredients__add:hover { background: var(--color-primary-soft); }
      .scanner-ingredients__list { display: flex; flex-direction: column; gap: 10px; }
      .scanner-ingredient-row { background: var(--color-bg); border-radius: var(--radius-md); padding: 12px 14px; }
      .scanner-ingredient-row__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
      .scanner-ingredient-row__top h4 { margin: 0; font-size: 0.92rem; }
      .scanner-ingredient-row__actions { display: flex; gap: 4px; }
      .scanner-ingredient-row__actions button {
        border: none; background: transparent; padding: 5px; border-radius: 6px;
        color: var(--color-ink-soft); cursor: pointer; display: flex;
      }
      .scanner-ingredient-row__actions button:hover { background: var(--color-surface); color: var(--color-primary); }
      .scanner-ingredient-row__macros { display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.78rem; font-weight: 600; }

      .scanner-disclaimer {
        display: flex; align-items: flex-start; gap: 7px; margin: 0;
        font-size: 0.78rem; color: var(--color-ink-soft); line-height: 1.4;
      }
      .scanner-disclaimer svg { flex-shrink: 0; margin-top: 2px; color: var(--color-ink-soft); }

      .scanner-coach {
        display: flex; gap: 12px; background: var(--color-primary-soft); border: 1px solid var(--color-primary);
        border-radius: var(--radius-lg); padding: 18px 20px;
      }
      .scanner-coach__icon {
        width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--gradient-primary);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .scanner-coach h3 { margin: 0 0 6px; font-size: 1rem; }
      .scanner-coach p { margin: 0 0 8px; font-size: 0.92rem; }
      .scanner-coach__tips { margin: 0; padding-left: 18px; font-size: 0.86rem; color: var(--color-ink-soft); }
      .scanner-coach__tips li { margin-bottom: 3px; }

      .scanner-save { padding: 20px; }
      .scanner-save label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; }
      .scanner-save input {
        width: 100%; background: var(--color-bg); border: 1px solid var(--color-line);
        border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 14px; color: var(--color-ink);
      }
      .scanner-save input:focus { border-color: var(--color-primary); }
    `}
    </style>
  );
}

function sumIngredients(ingredients) {
  return ingredients.reduce((acc, ing) => ({
    totalCalories: acc.totalCalories + (Number(ing.calories) || 0),
    totalProteinG: acc.totalProteinG + (Number(ing.proteinG) || 0),
    totalCarbsG: acc.totalCarbsG + (Number(ing.carbsG) || 0),
    totalFatG: acc.totalFatG + (Number(ing.fatG) || 0),
  }), { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 });
}

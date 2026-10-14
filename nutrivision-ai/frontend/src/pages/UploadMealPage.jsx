import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, Pencil, X, Lightbulb, ImagePlus, ArrowLeft, RotateCcw, Crown, ScanLine,
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import IngredientEditor from '../components/IngredientEditor';
import { CoachCard, MacroTotals, Message, PageTitle, SectionHeader } from '../components/ui';
import {
  withBasis, stripClientFields, sumIngredients, ingredientsSignature,
} from '../utils/ingredients';
import { shrinkImage } from '../utils/image';

const MAX_BYTES = 5 * 1024 * 1024; // lo que acepta el backend (después de achicar la foto)
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024; // fotos originales más pesadas se achican antes de subir
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

  // Estado de la regeneración del Coach después de editar ingredientes.
  const [coachUpdating, setCoachUpdating] = useState(false);
  const [coachError, setCoachError] = useState(null);
  const coachRequestId = useRef(0);

  // Escaneos disponibles hoy (plan Gratuito: 3 por día). null = cargando.
  const [quota, setQuota] = useState(null);
  const loadQuota = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/plan');
      setQuota(data);
    } catch {
      setQuota(false);
    }
  }, []);
  useEffect(() => { loadQuota(); }, [loadQuota]);
  const limitReached = Boolean(quota && !quota.isPremium && quota.plan !== 'PREMIUM' && quota.scansRemaining === 0);

  const analyze = useCallback(async (selectedFile) => {
    setAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      const { data } = await apiClient.post('/meals/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // El análisis real con Gemini (visión + coach) puede tardar más que
        // el timeout general de 20 s del cliente.
        timeout: 90000,
      });
      setAnalysis({ ...data, ingredients: data.ingredients.map(withBasis) });
      setCoachError(null);
      // Pre-cargamos el nombre sugerido por la IA; el usuario lo puede cambiar.
      if (data.dishName) setPlateName(data.dishName);
    } catch (err) {
      setError(err.message);
      setPreviewUrl(null);
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const validateAndAnalyze = useCallback(async (selectedFile) => {
    setError(null);
    if (!selectedFile) return;
    if (limitReached) { setError('Llegaste al límite de escaneos de hoy.'); return; }
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) { setError('Formato no soportado. Usá JPG, PNG o WEBP.'); return; }
    if (selectedFile.size > MAX_ORIGINAL_BYTES) { setError('La imagen es muy pesada. Probá con otra foto.'); return; }
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setAnalyzing(true);
    // Se achica antes de subirla (lado más largo 1280 px).
    const small = await shrinkImage(selectedFile);
    if (small.size > MAX_BYTES) {
      setAnalyzing(false);
      setPreviewUrl(null);
      setError('La imagen es muy pesada. El máximo es 5 MB.');
      return;
    }
    setFile(small);
    analyze(small);
  }, [analyze, limitReached]);

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
    setCoachError(null);
    setCoachUpdating(false);
    coachRequestId.current += 1;
  }

  function startEditing() {
    setDraftIngredients(analysis.ingredients.map((ing) => ({ ...ing })));
    setEditing(true);
  }

  const lookupsPending = draftIngredients.some((ing) => ing._lookup === 'pending');

  function applyIngredientEdits() {
    if (lookupsPending) return;
    const cleaned = draftIngredients
      .map((ing) => ({ ...ing, _lookup: undefined, _lookupError: undefined }))
      .filter((ing) => String(ing.name).trim());
    if (cleaned.length === 0) {
      setError('El plato necesita al menos un ingrediente con nombre.');
      return;
    }
    setError(null);
    const changed = ingredientsSignature(cleaned) !== ingredientsSignature(analysis.ingredients);
    setAnalysis((a) => ({ ...a, ingredients: cleaned, totals: sumIngredients(cleaned) }));
    setEditing(false);
    // El consejo del Coach tiene que corresponder al plato como quedó.
    if (changed) regenerateCoach(cleaned);
  }

  async function regenerateCoach(ingredients) {
    coachRequestId.current += 1;
    const requestId = coachRequestId.current;
    setCoachUpdating(true);
    setCoachError(null);
    try {
      const { data } = await apiClient.post('/meals/coach', {
        dishName: plateName.trim(),
        ingredients: ingredients.map(stripClientFields),
      }, { timeout: 60000 });
      if (requestId !== coachRequestId.current) return;
      setAnalysis((a) => (a ? { ...a, coachFeedback: data.coachFeedback, coachMocked: data.coachMocked } : a));
    } catch (err) {
      if (requestId !== coachRequestId.current) return;
      setCoachError(`No se pudo actualizar la devolución del Coach (${err.message}). La que ves corresponde al plato antes de editarlo.`);
    } finally {
      if (requestId === coachRequestId.current) setCoachUpdating(false);
    }
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
      formData.append('ingredients', JSON.stringify(analysis.ingredients.map(stripClientFields)));
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
  // No se guarda mientras el Coach se está actualizando (así lo que se
  // guarda corresponde al plato final) ni con el editor abierto.
  const canConfirm = Boolean(plateName.trim()) && !saving && !coachUpdating && !editing;

  // ------- Estado inicial: todavía no se subió nada -------
  if (!analysis) {
    return (
      <div className="page scanner-page">
        <PageTitle title="Escáner IA" subtitle="Sacá una foto de tu plato y la IA calcula sus nutrientes." />

        {error && <Message>{error}</Message>}

        {/* Escaneos disponibles hoy */}
        {quota ? (
          <div className={`card scanner-quota${limitReached ? ' is-limit' : ''}`}>
            <span className={`icon-tile${quota.isPremium ? ' icon-tile--accent' : ''}`}>
              {quota.isPremium ? <Crown size={20} /> : <ScanLine size={20} />}
            </span>
            <div className="scanner-quota__text">
              <strong>{quota.isPremium ? 'Escaneos ilimitados' : 'Escaneos disponibles hoy'}</strong>
              <span>
                {quota.isPremium
                  ? 'Plan NutriVision Pro'
                  : limitReached
                    ? 'Llegaste al límite de hoy. Mañana se renuevan, o pasate a Pro desde la app.'
                    : `Plan Gratuito · ${quota.freeDailyScanLimit} por día`}
              </span>
            </div>
            {!quota.isPremium ? (
              <div className="scanner-quota__count">
                <strong>{quota.scansRemaining ?? 0}</strong>
                <span>de {quota.freeDailyScanLimit}</span>
              </div>
            ) : null}
            {limitReached ? <Link to="/pricing" className="btn btn-accent scanner-quota__cta"><Crown size={16} /> Ver Pro</Link> : null}
          </div>
        ) : null}

        <div className={`scanner-start${limitReached ? ' is-locked' : ''}`}>
          <div
            className={`scanner-viewfinder${dragging ? ' is-dragging' : ''}${previewUrl ? ' has-photo' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => (limitReached ? e.preventDefault() : handleDrop(e))}
            onClick={() => !analyzing && !limitReached && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Subir una foto del plato"
            aria-disabled={limitReached}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !analyzing && !limitReached) inputRef.current?.click(); }}
          >
            <input
              ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} hidden
              onChange={(e) => validateAndAnalyze(e.target.files?.[0])}
            />

            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Plato adjuntado" className="scanner-viewfinder__photo" />
                <div className="scanner-viewfinder__overlay">
                  <span className="scanner-viewfinder__spinner" aria-hidden="true" />
                  <strong>Analizando con IA…</strong>
                  <span>Identificando ingredientes y porciones</span>
                </div>
              </>
            ) : (
              <>
                <span className="scanner-corner scanner-corner--tl" />
                <span className="scanner-corner scanner-corner--tr" />
                <span className="scanner-corner scanner-corner--bl" />
                <span className="scanner-corner scanner-corner--br" />
                <img src="/logo.png" alt="" className="scanner-viewfinder__logo" />
                <span className="badge badge--white"><Sparkles size={12} /> Escaneo con IA</span>
                <p className="scanner-viewfinder__text">
                  Hacé clic para elegir una foto de tu plato o arrastrala acá.
                </p>
                <span className="btn btn-primary scanner-viewfinder__cta">
                  <ImagePlus size={18} /> Elegir foto
                </span>
                <span className="hint">JPG, PNG o WEBP · la foto se achica sola antes de subirla</span>
              </>
            )}
          </div>

          <section className="card scanner-tips">
            <SectionHeader title="Consejos para una buena foto" />
            {TIPS.map((tip, i) => (
              <div className="scanner-tips__row" key={tip}>
                <span className="scanner-tips__num">{i + 1}</span>
                <p>{tip}</p>
              </div>
            ))}
            <p className="scanner-tips__foot">
              <Lightbulb size={15} />
              El análisis tarda unos segundos: la foto se envía a la IA y se calculan los nutrientes de cada ingrediente.
            </p>
          </section>
        </div>

        <ScannerStyles />
      </div>
    );
  }

  // ------- Estado con análisis: resultados -------
  return (
    <div className="page scanner-page">
      <PageTitle
        title="Resultado del análisis"
        subtitle="Revisá lo que detectó la IA y guardá tu plato."
        back={(
          <button type="button" className="icon-btn" onClick={resetScanner} aria-label="Escanear otro plato">
            <ArrowLeft size={20} />
          </button>
        )}
      />

      {error && <Message>{error}</Message>}

      {analysis.mocked && (
        <Message>
          Modo simulado: el backend no tiene una GEMINI_API_KEY configurada, así que estos
          ingredientes son de ejemplo y no corresponden a tu foto.
        </Message>
      )}

      <div className="scanner-results">
        <div className="scanner-results__side">
          <section className="card card--flush">
            <img src={previewUrl} alt="Plato analizado" className="scanner-results__photo" />
            <div className="scanner-results__summary">
              <div className="scanner-results__status">
                <span className="scanner-results__dot" />
                Análisis completado
              </div>
              <MacroTotals
                calories={totals.totalCalories}
                proteinG={totals.totalProteinG}
                carbsG={totals.totalCarbsG}
                fatG={totals.totalFatG}
              />
              <button type="button" className="btn btn-ghost btn-block" onClick={resetScanner}>
                <RotateCcw size={16} /> Escanear otro plato
              </button>
            </div>
          </section>
        </div>

        <div className="scanner-results__main">
          <section className="card">
            <div className="section-header">
              <h3>Ingredientes detectados</h3>
              {!editing ? (
                <button type="button" className="pill-btn pill-btn--soft" onClick={startEditing}>
                  <Pencil size={13} /> Editar
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="pill-btn pill-btn--outline" onClick={() => setEditing(false)}>
                    <X size={13} /> Cancelar
                  </button>
                  <button type="button" className="pill-btn pill-btn--solid" onClick={applyIngredientEdits} disabled={lookupsPending}>
                    {lookupsPending ? 'Recalculando…' : 'Listo'}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <>
                <p className="hint" style={{ marginBottom: 12 }}>
                  Si la IA confundió un ingrediente, corregí el nombre: al salir del campo se recalculan sus calorías y macros.
                </p>
                <IngredientEditor ingredients={draftIngredients} onChange={setDraftIngredients} disabled={false} />
              </>
            ) : (
              <div>
                {analysis.ingredients.map((ing) => (
                  <div className="ingredient-row" key={ing._uid}>
                    <div className="ingredient-row__top">
                      <span className="ingredient-row__name">{ing.name}</span>
                      <span className="ingredient-row__grams">{Math.round(ing.grams)} g</span>
                    </div>
                    <span className="ingredient-row__macros">
                      <span style={{ color: 'var(--color-primary)' }}>{Math.round(ing.calories)} kcal</span>
                      {' · '}
                      <span style={{ color: 'var(--macro-protein)' }}>{Math.round(ing.proteinG)}g P</span>
                      {' · '}
                      <span style={{ color: 'var(--macro-carbs)' }}>{Math.round(ing.carbsG)}g C</span>
                      {' · '}
                      <span style={{ color: 'var(--macro-fats)' }}>{Math.round(ing.fatG)}g G</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <CoachCard
            feedback={feedback}
            updating={coachUpdating}
            notes={[
              coachUpdating ? 'Actualizando la devolución según tus cambios…' : null,
              coachError,
              analysis.coachMocked && !coachUpdating
                ? 'Devolución básica calculada con reglas simples: la IA no respondió en este momento.'
                : null,
            ]}
          />

          <section className="card scanner-save">
            <label htmlFor="plateName" className="field-label">
              Nombre del plato <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="plateName" className="input" type="text" placeholder="Ej: Almuerzo fitness" maxLength={120} required
              value={plateName} onChange={(e) => setPlateName(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-block" onClick={handleConfirm} disabled={!canConfirm}>
              {saving ? 'Guardando…' : 'Agregar a comidas de hoy'}
            </button>
            {editing && (
              <p className="hint">Terminá de editar los ingredientes (Listo o Cancelar) antes de agregar el plato.</p>
            )}
            <p className="hint">El plato recién se guarda en tu historial cuando le ponés un nombre y confirmás acá.</p>
          </section>
        </div>
      </div>

      <ScannerStyles />
    </div>
  );
}

const TIPS = [
  'Buena luz: mejor luz natural y sin sombras fuertes sobre el plato.',
  'Encuadrá el plato completo, visto desde arriba o apenas inclinado.',
  'Si hay salsas o ingredientes escondidos, después podés corregirlos a mano.',
];

function ScannerStyles() {
  return (
    <style>{`
      /* ---- Estado inicial ---- */
      .scanner-start { display: grid; grid-template-columns: 1.35fr 1fr; gap: 20px; align-items: start; }
      .scanner-start.is-locked .scanner-viewfinder { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
      .scanner-quota { display: flex; align-items: center; gap: 14px; padding: 14px 18px; flex-wrap: wrap; }
      .scanner-quota.is-limit { background: var(--color-accent-soft); box-shadow: none; }
      .scanner-quota__text { flex: 1; min-width: 180px; display: flex; flex-direction: column; }
      .scanner-quota__text strong { font-size: 0.98rem; font-weight: 800; }
      .scanner-quota__text span { font-size: 0.82rem; color: var(--color-ink-soft); }
      .scanner-quota__count { display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
      .scanner-quota__count strong { font-size: 1.6rem; font-weight: 800; color: var(--color-primary); }
      .scanner-quota.is-limit .scanner-quota__count strong { color: var(--color-danger); }
      .scanner-quota__count span { font-size: 0.74rem; color: var(--color-ink-soft); font-weight: 600; }
      .scanner-quota__cta { padding: 9px 16px; }
      @media (max-width: 960px) { .scanner-start { grid-template-columns: 1fr; gap: 16px; } }

      .scanner-viewfinder {
        position: relative; overflow: hidden; min-height: 400px; border-radius: var(--radius-xl);
        background: var(--color-primary-soft); display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 12px; padding: 36px 24px; text-align: center; cursor: pointer;
        outline: 2px dashed transparent; outline-offset: -12px; transition: outline-color 0.15s ease, background 0.15s ease;
      }
      .scanner-viewfinder:hover, .scanner-viewfinder.is-dragging { background: #D8F0E2; }
      .scanner-viewfinder.is-dragging { outline-color: var(--color-primary); }
      .scanner-viewfinder.has-photo { cursor: default; padding: 0; }
      @media (max-width: 600px) { .scanner-viewfinder { min-height: 340px; } }

      .scanner-corner { position: absolute; width: 30px; height: 30px; border: 0 solid var(--color-primary); }
      .scanner-corner--tl { top: 20px; left: 20px; border-top-width: 4px; border-left-width: 4px; border-top-left-radius: 14px; }
      .scanner-corner--tr { top: 20px; right: 20px; border-top-width: 4px; border-right-width: 4px; border-top-right-radius: 14px; }
      .scanner-corner--bl { bottom: 20px; left: 20px; border-bottom-width: 4px; border-left-width: 4px; border-bottom-left-radius: 14px; }
      .scanner-corner--br { bottom: 20px; right: 20px; border-bottom-width: 4px; border-right-width: 4px; border-bottom-right-radius: 14px; }

      .scanner-viewfinder__logo { height: 112px; width: auto; opacity: 0.95; }
      .scanner-viewfinder .badge { align-self: center; }
      .scanner-viewfinder__text { margin: 0; color: var(--color-ink-soft); font-size: 0.92rem; max-width: 280px; }
      .scanner-viewfinder__cta { margin-top: 4px; pointer-events: none; }

      .scanner-viewfinder__photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .scanner-viewfinder__overlay {
        position: absolute; inset: 0; background: rgba(14, 122, 58, 0.58); color: #fff;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      }
      .scanner-viewfinder__overlay strong { font-size: 1.2rem; font-weight: 800; }
      .scanner-viewfinder__overlay span:last-child { font-size: 0.88rem; opacity: 0.9; }
      .scanner-viewfinder__spinner {
        width: 40px; height: 40px; border-radius: 50%; margin-bottom: 8px;
        border: 4px solid rgba(255,255,255,0.35); border-top-color: #fff; animation: spin 0.9s linear infinite;
      }

      .scanner-tips__row { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; }
      .scanner-tips__row p { margin: 0; color: var(--color-ink-soft); font-size: 0.88rem; line-height: 1.5; }
      .scanner-tips__num {
        width: 24px; height: 24px; border-radius: 50%; background: var(--color-accent-soft); color: var(--color-accent-ink);
        display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 800; flex-shrink: 0;
      }
      .scanner-tips__foot {
        display: flex; gap: 8px; align-items: flex-start; margin: 10px 0 0; padding-top: 12px; border-top: 1px solid var(--color-line);
        font-size: 0.8rem; color: var(--color-ink-soft); line-height: 1.45;
      }
      .scanner-tips__foot svg { color: var(--color-accent); flex-shrink: 0; margin-top: 1px; }

      /* ---- Resultados ---- */
      .scanner-results { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 20px; align-items: start; }
      @media (max-width: 960px) { .scanner-results { grid-template-columns: 1fr; gap: 16px; } }
      .scanner-results__side { position: sticky; top: 24px; }
      @media (max-width: 960px) { .scanner-results__side { position: static; } }
      .scanner-results__main { display: flex; flex-direction: column; gap: 16px; }
      .scanner-results__photo { width: 100%; height: 240px; object-fit: cover; display: block; background: var(--color-bg); }
      .scanner-results__summary { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .scanner-results__status { display: flex; align-items: center; gap: 8px; font-size: 0.86rem; font-weight: 700; color: var(--color-primary-dark); }
      .scanner-results__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary); }

      .scanner-save { display: flex; flex-direction: column; gap: 10px; }
    `}
    </style>
  );
}

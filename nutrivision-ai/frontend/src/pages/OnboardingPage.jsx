import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Brain } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

const TOTAL_STEPS = 3;

const SEX_OPTIONS = [
  { value: 'MALE', label: 'Masculino', emoji: '♂️' },
  { value: 'FEMALE', label: 'Femenino', emoji: '♀️' },
  { value: 'OTHER', label: 'Otro', emoji: '⚧️' },
];

const ACTIVITY_OPTIONS = [
  { value: 'SEDENTARY', label: 'Sedentario', desc: 'Pasa la mayor parte del tiempo sentado', emoji: '🪑' },
  { value: 'LIGHT', label: 'Ligero', desc: 'Camina un poco o hace ejercicio ligero 1–2 veces por semana', emoji: '🚶' },
  { value: 'MODERATE', label: 'Moderado', desc: 'Entrena de 3 a 5 veces por semana', emoji: '🏋️' },
  { value: 'ACTIVE', label: 'Activo', desc: 'Entrena de 6 a 7 veces por semana', emoji: '🏃' },
  { value: 'VERY_ACTIVE', label: 'Muy Activo', desc: 'Entrena intensamente casi todos los días', emoji: '⚡' },
];

const GOAL_OPTIONS = [
  { value: 'LOSE_WEIGHT', label: 'Perder Peso', subtitle: 'Déficit calórico', emoji: '🔥' },
  { value: 'MAINTAIN', label: 'Mantener el Peso', subtitle: 'Equilibrio calórico', emoji: '⚖️' },
  { value: 'GAIN_MUSCLE', label: 'Ganar Masa Muscular', subtitle: 'Superávit + proteína', emoji: '💪' },
  { value: 'GAIN_WEIGHT', label: 'Aumentar de Peso', subtitle: 'Superávit calórico', emoji: '📈' },
  { value: 'MODIFY_DIET', label: 'Modificar Mi Dieta', subtitle: 'Cambiar hábitos', emoji: '🥗' },
];

export default function OnboardingPage() {
  const { setProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ age: '', weightKg: '', heightCm: '', sex: null, activityLevel: null, goal: null });

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function canProceed() {
    if (step === 1) return form.age && form.weightKg && form.heightCm && form.sex;
    if (step === 2) return Boolean(form.activityLevel);
    if (step === 3) return Boolean(form.goal);
    return false;
  }

  async function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    // Último paso: dispara el cálculo real contra el backend.
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.put('/users/me/onboarding', {
        weightKg: Number(form.weightKg),
        heightCm: Number(form.heightCm),
        age: Number(form.age),
        sex: form.sex,
        activityLevel: form.activityLevel,
        goal: form.goal,
      });
      setProfile(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="onboarding">
        <div className="container onboarding__container">
          <div className="onboarding__loading">
            <div className="onboarding__loading-icon-wrap">
              <div className="onboarding__loading-icon"><Brain size={40} color="#fff" /></div>
              <div className="onboarding__loading-ring" />
            </div>
            <h2>Calculando tus metas…</h2>
            <p className="helper-text" style={{ maxWidth: 260 }}>Estamos armando tu plan nutricional personalizado</p>
            <div className="onboarding__loading-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
        <style>{`
          .onboarding__loading { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 0; }
          .onboarding__loading-icon-wrap { position: relative; margin-bottom: 30px; }
          .onboarding__loading-icon {
            width: 92px; height: 92px; border-radius: var(--radius-lg); background: var(--gradient-primary);
            display: flex; align-items: center; justify-content: center; box-shadow: 0 16px 40px rgba(24,155,78,0.35); position: relative; z-index: 1;
          }
          .onboarding__loading-ring {
            position: absolute; inset: -10px; border-radius: 28px; background: var(--gradient-primary); opacity: 0.2;
            animation: onboarding-pulse 1.6s ease-in-out infinite;
          }
          @keyframes onboarding-pulse { 0%, 100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.06); } }
          .onboarding__loading h2 { margin: 0 0 8px; }
          .onboarding__loading-dots { display: flex; gap: 8px; margin-top: 30px; }
          .onboarding__loading-dots span {
            width: 11px; height: 11px; border-radius: 50%; background: var(--color-primary);
            animation: onboarding-bounce 1s ease-in-out infinite;
          }
          .onboarding__loading-dots span:nth-child(2) { animation-delay: 0.15s; }
          .onboarding__loading-dots span:nth-child(3) { animation-delay: 0.3s; }
          @keyframes onboarding-bounce { 0%, 100% { transform: translateY(0); opacity: 0.5; } 50% { transform: translateY(-8px); opacity: 1; } }
        `}
        </style>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="container onboarding__container">
        <div className="onboarding__progress">
          <div className="onboarding__progress-top">
            <span className="helper-text">Paso {step} de {TOTAL_STEPS}</span>
            <span className="onboarding__progress-pct">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="onboarding__progress-track">
            <div className="onboarding__progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        {step === 1 && (
          <div>
            <h2>Datos Biométricos</h2>
            <p className="helper-text" style={{ marginBottom: 22 }}>Necesitamos esto para calcular tus metas personalizadas</p>

            <div className="onboarding__grid2">
              <div className="field">
                <label htmlFor="age">Edad</label>
                <div className="onboarding__number-input">
                  <input id="age" type="number" min="10" max="100" placeholder="25" value={form.age} onChange={(e) => update('age', e.target.value)} />
                  <span>años</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="height">Altura</label>
                <div className="onboarding__number-input">
                  <input id="height" type="number" min="100" max="250" placeholder="170" value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} />
                  <span>cm</span>
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="weight">Peso Actual</label>
              <div className="onboarding__number-input">
                <input id="weight" type="number" min="30" max="300" step="0.1" placeholder="70.0" value={form.weightKg} onChange={(e) => update('weightKg', e.target.value)} />
                <span>kg</span>
              </div>
            </div>

            <div className="field">
              <label>Sexo Biológico</label>
              <div className="onboarding__sex-grid">
                {SEX_OPTIONS.map((opt) => (
                  <button
                    key={opt.value} type="button"
                    className={`onboarding__sex-btn${form.sex === opt.value ? ' is-active' : ''}`}
                    onClick={() => update('sex', opt.value)}
                  >
                    <span className="onboarding__sex-emoji">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2>Nivel de Actividad</h2>
            <p className="helper-text" style={{ marginBottom: 22 }}>¿Cuál te describe mejor?</p>
            <div className="onboarding__option-list">
              {ACTIVITY_OPTIONS.map((opt) => {
                const active = form.activityLevel === opt.value;
                return (
                  <button
                    key={opt.value} type="button"
                    className={`onboarding__option-row${active ? ' is-active' : ''}`}
                    onClick={() => update('activityLevel', opt.value)}
                  >
                    <span className="onboarding__option-emoji">{opt.emoji}</span>
                    <span className="onboarding__option-text">
                      <span className="onboarding__option-title">{opt.label}</span>
                      <span className="helper-text">{opt.desc}</span>
                    </span>
                    <span className={`onboarding__radio${active ? ' is-active' : ''}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2>Tu Objetivo</h2>
            <p className="helper-text" style={{ marginBottom: 22 }}>¿Qué querés lograr con NutriVision AI?</p>
            <div className="onboarding__goal-grid">
              {GOAL_OPTIONS.map((opt) => {
                const active = form.goal === opt.value;
                return (
                  <button
                    key={opt.value} type="button"
                    className={`onboarding__goal-card${active ? ' is-active' : ''}`}
                    onClick={() => update('goal', opt.value)}
                  >
                    <span className="onboarding__goal-emoji">{opt.emoji}</span>
                    <span className="onboarding__goal-title">{opt.label}</span>
                    <span className="helper-text">{opt.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="field-error" style={{ marginTop: 16 }}>{error}</p>}

        <div className="onboarding__actions">
          {step > 1 && (
            <button type="button" className="onboarding__back-btn" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={16} /> Atrás
            </button>
          )}
          <button
            type="button"
            className={`onboarding__next-btn${!canProceed() ? ' is-disabled' : ''}`}
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {step === TOTAL_STEPS ? 'Comenzar' : 'Continuar'} <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        .onboarding { flex: 1; display: flex; align-items: center; padding: 48px 0; }
        .onboarding__container { max-width: 560px; }
        .onboarding__progress { margin-bottom: 30px; }
        .onboarding__progress-top { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .onboarding__progress-pct { font-size: 0.85rem; font-weight: 700; color: var(--color-primary); }
        .onboarding__progress-track { height: 8px; background: var(--color-line); border-radius: 999px; overflow: hidden; }
        .onboarding__progress-fill { height: 100%; background: var(--gradient-primary); border-radius: 999px; transition: width 0.4s ease; }

        .onboarding h2 { font-size: 1.5rem; margin: 0 0 4px; }
        .onboarding__grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
        .onboarding__number-input { position: relative; margin-bottom: 18px; }
        .onboarding__number-input input {
          width: 100%; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 13px 40px;
          border: 1.5px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-bg);
        }
        .onboarding__number-input input:focus { border-color: var(--color-primary); background: var(--color-surface); }
        .onboarding__number-input span {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 0.78rem; color: var(--color-ink-soft);
        }

        .onboarding__sex-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .onboarding__sex-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 8px;
          border-radius: var(--radius-md); border: 2px solid var(--color-line); background: var(--color-bg);
          font-weight: 600; font-size: 0.85rem; cursor: pointer;
        }
        .onboarding__sex-btn.is-active { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
        .onboarding__sex-emoji { font-size: 1.6rem; }

        .onboarding__option-list { display: flex; flex-direction: column; gap: 10px; }
        .onboarding__option-row {
          display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: var(--radius-md);
          border: 2px solid var(--color-line); background: var(--color-bg); text-align: left; cursor: pointer;
        }
        .onboarding__option-row.is-active { border-color: var(--color-primary); background: var(--color-primary-soft); }
        .onboarding__option-emoji {
          width: 44px; height: 44px; border-radius: var(--radius-sm); background: var(--color-surface);
          display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;
        }
        .onboarding__option-text { flex: 1; display: flex; flex-direction: column; gap: 1px; }
        .onboarding__option-title { font-weight: 700; font-size: 0.92rem; }
        .onboarding__radio {
          width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--color-line); flex-shrink: 0;
        }
        .onboarding__radio.is-active { border-color: var(--color-primary); background: var(--color-primary); position: relative; }
        .onboarding__radio.is-active::after {
          content: ''; position: absolute; inset: 4px; border-radius: 50%; background: #fff;
        }

        .onboarding__goal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .onboarding__goal-card {
          display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 20px;
          border-radius: var(--radius-md); border: 2px solid var(--color-line); background: var(--color-bg); cursor: pointer; text-align: left;
        }
        .onboarding__goal-card.is-active { border-color: var(--color-primary); background: var(--color-primary-soft); }
        .onboarding__goal-emoji { font-size: 1.8rem; }
        .onboarding__goal-title { font-weight: 700; font-size: 0.92rem; }

        .onboarding__actions { display: flex; gap: 12px; margin-top: 30px; }
        .onboarding__back-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px;
          border-radius: var(--radius-md); border: 2px solid var(--color-line); background: var(--color-surface);
          font-weight: 700; cursor: pointer;
        }
        .onboarding__back-btn:hover { background: var(--color-bg); }
        .onboarding__next-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px;
          border-radius: var(--radius-md); border: none; background: var(--gradient-primary); color: #fff;
          font-weight: 700; cursor: pointer; transition: box-shadow 0.15s ease;
        }
        .onboarding__next-btn:hover:not(.is-disabled) { box-shadow: 0 10px 24px rgba(24,155,78,0.35); }
        .onboarding__next-btn.is-disabled { background: var(--color-line); color: var(--color-ink-soft); cursor: not-allowed; }

        @media (max-width: 520px) { .onboarding__grid2 { grid-template-columns: 1fr; } .onboarding__goal-grid { grid-template-columns: 1fr; } }
      `}
      </style>
    </div>
  );
}

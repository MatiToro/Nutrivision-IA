import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Brain } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { ChipGroup, Message, NumberField, OptionCard } from '../components/ui';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS } from '../constants/profile';
import { parseBirthDate } from '../utils/age';

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const { profile, setProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ day: '', month: '', year: '', weightKg: '', heightCm: '', sex: null, activityLevel: null, goal: null });

  const firstName = (profile?.displayName || '').split(' ')[0];

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  // Fecha de nacimiento (DD/MM/AAAA): la edad se calcula sola y se mantiene al día.
  const birth = parseBirthDate(form.day, form.month, form.year);
  const birthComplete = form.day && form.month && String(form.year).length === 4;

  function canProceed() {
    if (step === 1) return birthComplete && form.weightKg && form.heightCm && form.sex;
    if (step === 2) return Boolean(form.activityLevel);
    if (step === 3) return Boolean(form.goal);
    return false;
  }

  async function handleNext() {
    if (step === 1 && birth.error) {
      setError(birth.error);
      return;
    }
    if (step < TOTAL_STEPS) {
      setError(null);
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
        birthDate: birth.iso,
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
      <div className="onboarding onboarding--calc">
        <div className="onboarding__calc-icon"><Brain size={42} color="#fff" /></div>
        <h2>Calculando tus metas…</h2>
        <p>Estamos armando tu plan nutricional personalizado</p>
        <div className="onboarding__dots"><span /><span /><span /></div>
        <OnboardingStyles />
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="onboarding__inner">
        <div className="onboarding__top">
          {step > 1 ? (
            <button type="button" className="icon-btn" onClick={() => setStep((s) => s - 1)} aria-label="Paso anterior">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <img src="/logo.png" alt="" className="onboarding__logo" />
          )}
          <span className="onboarding__step">Paso {step} de {TOTAL_STEPS}</span>
          <span style={{ width: 40 }} />
        </div>

        <div className="onboarding__track">
          <div className="onboarding__fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        {step === 1 && (
          <section className="onboarding__section">
            <div>
              <h1>{firstName ? `¡Hola, ${firstName}! ` : ''}Contanos sobre vos</h1>
              <p className="onboarding__subtitle">Necesitamos estos datos para calcular tus metas personalizadas.</p>
            </div>

            <div className="card onboarding__card">
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Fecha de nacimiento</span>
                <div className="onboarding__birth">
                  <NumberField id="birth-day" placeholder="DD" min="1" max="31" value={form.day} onChange={(v) => update('day', v.slice(0, 2))} aria-label="Día de nacimiento" />
                  <NumberField id="birth-month" placeholder="MM" min="1" max="12" value={form.month} onChange={(v) => update('month', v.slice(0, 2))} aria-label="Mes de nacimiento" />
                  <NumberField id="birth-year" placeholder="AAAA" min="1900" max="2100" value={form.year} onChange={(v) => update('year', v.slice(0, 4))} aria-label="Año de nacimiento" />
                </div>
                <span className="hint">
                  {birthComplete && !birth.error ? `Tenés ${birth.age} años. Tu edad se actualiza sola.` : 'Día, mes y año. Con esto calculamos tu edad.'}
                </span>
              </div>
              <div className="onboarding__row">
                <NumberField id="height" label="Altura" unit="cm" min="80" max="260" placeholder="170" value={form.heightCm} onChange={(v) => update('heightCm', v)} />
                <NumberField id="weight" label="Peso actual" unit="kg" min="20" max="400" step="0.1" placeholder="70" value={form.weightKg} onChange={(v) => update('weightKg', v)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Sexo biológico</span>
                <ChipGroup label="Sexo biológico" options={SEX_OPTIONS} value={form.sex} onChange={(v) => update('sex', v)} />
                <span className="hint">Se usa para la fórmula del gasto calórico (Mifflin-St Jeor). No se puede cambiar después.</span>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding__section">
            <div>
              <h1>Nivel de actividad</h1>
              <p className="onboarding__subtitle">¿Cuál te describe mejor?</p>
            </div>
            <div className="onboarding__options" role="radiogroup" aria-label="Nivel de actividad">
              {ACTIVITY_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} option={opt} active={form.activityLevel === opt.value} onSelect={() => update('activityLevel', opt.value)} />
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onboarding__section">
            <div>
              <h1>Tu objetivo</h1>
              <p className="onboarding__subtitle">¿Qué querés lograr con NutriVision IA?</p>
            </div>
            <div className="onboarding__options" role="radiogroup" aria-label="Objetivo">
              {GOAL_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} option={opt} active={form.goal === opt.value} onSelect={() => update('goal', opt.value)} />
              ))}
            </div>
          </section>
        )}

        {error && <Message>{error}</Message>}

        <button type="button" className="btn btn-primary btn-block onboarding__next" onClick={handleNext} disabled={!canProceed()}>
          {step === TOTAL_STEPS ? 'Calcular mis metas' : 'Continuar'} <ArrowRight size={18} />
        </button>
      </div>

      <OnboardingStyles />
    </div>
  );
}

function OnboardingStyles() {
  return (
    <style>{`
      .onboarding { flex: 1; display: flex; justify-content: center; padding: 28px 16px 48px; }
      .onboarding__inner { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 18px; }
      .onboarding__top { display: flex; align-items: center; justify-content: space-between; }
      .onboarding__logo { height: 40px; width: 40px; object-fit: contain; }
      .onboarding__step { font-size: 0.9rem; font-weight: 700; color: var(--color-ink-soft); }
      .onboarding__track { height: 8px; border-radius: 4px; background: var(--color-line); overflow: hidden; }
      .onboarding__fill { height: 100%; border-radius: 4px; background: var(--gradient-primary); transition: width 0.4s ease; }

      .onboarding__section { display: flex; flex-direction: column; gap: 16px; }
      .onboarding__section h1 { font-size: 1.6rem; margin: 0; }
      .onboarding__subtitle { margin: 4px 0 0; color: var(--color-ink-soft); font-size: 0.93rem; }
      .onboarding__card { display: flex; flex-direction: column; gap: 16px; }
      .onboarding__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .onboarding__birth { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 10px; }
      .onboarding__options { display: flex; flex-direction: column; gap: 10px; }
      .onboarding__next { margin-top: 4px; }

      .onboarding--calc { flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 100vh; }
      .onboarding__calc-icon {
        width: 96px; height: 96px; border-radius: var(--radius-lg); background: var(--gradient-primary);
        display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-float);
        animation: onboarding-pulse 1.6s ease-in-out infinite;
      }
      @keyframes onboarding-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      .onboarding--calc h2 { margin: 22px 0 4px; font-size: 1.5rem; }
      .onboarding--calc p { margin: 0; color: var(--color-ink-soft); max-width: 260px; }
      .onboarding__dots { display: flex; gap: 8px; margin-top: 22px; }
      .onboarding__dots span {
        width: 10px; height: 10px; border-radius: 50%; background: var(--color-primary);
        animation: onboarding-bounce 1s ease-in-out infinite;
      }
      .onboarding__dots span:nth-child(2) { animation-delay: 0.15s; }
      .onboarding__dots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes onboarding-bounce { 0%, 100% { transform: translateY(0); opacity: 0.5; } 50% { transform: translateY(-8px); opacity: 1; } }

      @media (max-width: 420px) { .onboarding__row { grid-template-columns: 1fr; } }
    `}
    </style>
  );
}

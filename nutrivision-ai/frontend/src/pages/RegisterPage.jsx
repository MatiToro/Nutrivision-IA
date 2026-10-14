import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Stethoscope, UserRound, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { GoogleIcon } from './LoginPage';
import LegalModal from '../components/LegalModal';

// Tipo de cuenta (un rol por cuenta: para ser paciente y nutricionista se usan correos distintos).
const ACCOUNT_TYPES = [
  { value: 'USER', label: 'Soy usuario', hint: 'Quiero cuidar mi alimentación', Icon: UserRound },
  { value: 'NUTRITIONIST', label: 'Soy nutricionista', hint: 'Quiero seguir a mis pacientes', Icon: Stethoscope },
];

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    role: 'USER', name: '', email: '', password: '', confirmPassword: '', acceptedTerms: false,
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);

  // Los enlaces están dentro del <label>: evitar que el clic marque o desmarque la casilla.
  const openLegal = (e, doc) => {
    e.preventDefault();
    e.stopPropagation();
    setLegalDoc(doc);
  };

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!form.acceptedTerms) {
      setError('Tenés que aceptar los Términos y la Política de Privacidad para continuar.');
      return;
    }

    setSubmitting(true);
    try {
      await register({ email: form.email, password: form.password, displayName: form.name, role: form.role });
      navigate('/', { replace: true });
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      // Primero se elige el tipo de cuenta y después se continúa con Google.
      await loginWithGoogle({ role: form.role });
      navigate('/', { replace: true });
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-form">
        <h2>Creá tu cuenta</h2>
        <p className="auth-form__subtitle">Comenzá tu viaje nutricional hoy mismo</p>

        <div className="account-types" role="radiogroup" aria-label="Tipo de cuenta">
          {ACCOUNT_TYPES.map(({ value, label, hint, Icon }) => {
            const active = form.role === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`account-type${active ? ' is-active' : ''}`}
                onClick={() => update('role', value)}
              >
                <Icon size={22} />
                <strong>{label}</strong>
                <span>{hint}</span>
              </button>
            );
          })}
        </div>
        {form.role === 'NUTRITIONIST' ? (
          <p className="account-types__note">
            Después de crear la cuenta vas a cargar tu matrícula. Un administrador la revisa antes de que aparezcas en el directorio.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-form__input">
            <User size={18} />
            <input
              type="text" autoComplete="name" required maxLength={100}
              placeholder={form.role === 'NUTRITIONIST' ? 'Nombre profesional (ej: Lic. Ana Pérez)' : 'Nombre completo'}
              aria-label="Nombre completo"
              value={form.name} onChange={(e) => update('name', e.target.value)}
            />
          </div>

          <div className="auth-form__input">
            <Mail size={18} />
            <input
              type="email" autoComplete="email" placeholder="Correo electrónico" required
              aria-label="Correo electrónico"
              value={form.email} onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div className="auth-form__input">
            <Lock size={18} />
            <input
              type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Contraseña" required minLength={6}
              aria-label="Contraseña"
              value={form.password} onChange={(e) => update('password', e.target.value)}
            />
            <button
              type="button" className="auth-form__eye" onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="auth-form__input">
            <Lock size={18} />
            <input
              type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Repetir contraseña" required
              aria-label="Repetir contraseña"
              value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)}
            />
            <button
              type="button" className="auth-form__eye" onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <p className="auth-form__hint">Mínimo 6 caracteres.</p>

          <label className="auth-form__terms">
            <input
              type="checkbox" checked={form.acceptedTerms}
              onChange={(e) => update('acceptedTerms', e.target.checked)}
            />
            <span>
              Acepto los{' '}
              <button type="button" className="auth-form__terms-link" onClick={(e) => openLegal(e, 'terms')}>Términos y Condiciones</button>
              {' '}y la{' '}
              <button type="button" className="auth-form__terms-link" onClick={(e) => openLegal(e, 'privacy')}>Política de Privacidad</button>
            </span>
          </label>

          {error && <p className="message" role="alert">{error}</p>}

          <button type="submit" className="auth-form__submit" disabled={submitting}>
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-form__divider"><span>o</span></div>

        <button type="button" className="auth-form__outline-btn" onClick={handleGoogle} disabled={submitting}>
          <GoogleIcon /> Continuar con Google
        </button>
        <p className="auth-form__google-note">
          Al continuar con Google aceptás los{' '}
          <button type="button" className="auth-form__terms-link" onClick={(e) => openLegal(e, 'terms')}>Términos</button>
          {' '}y la{' '}
          <button type="button" className="auth-form__terms-link" onClick={(e) => openLegal(e, 'privacy')}>Política de Privacidad</button>.
        </p>

        <p className="auth-form__footer">
          ¿Ya tenés cuenta?{' '}
          <button type="button" onClick={() => navigate('/login')}>Iniciá sesión</button>
        </p>
      </div>
      <style>{`
        .account-types { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .account-type {
          display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
          padding: 12px 8px; border-radius: 14px; border: 1.5px solid var(--color-line); background: var(--color-surface);
          color: var(--color-ink-muted); cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease;
        }
        .account-type:hover { border-color: #A8D9BC; }
        .account-type strong { font-size: 0.92rem; font-weight: 800; color: var(--color-ink); }
        .account-type span { font-size: 0.74rem; color: var(--color-ink-soft); }
        .account-type.is-active { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
        .account-type.is-active strong { color: var(--color-primary-dark); }
        .account-types__note { font-size: 0.8rem; color: var(--color-ink-soft); line-height: 1.45; margin: -2px 0 12px; }
      `}</style>
      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </AuthLayout>
  );
}

function mapFirebaseError(err) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use')) return 'Ese correo ya tiene una cuenta. Iniciá sesión.';
  if (code.includes('weak-password')) return 'La contraseña es muy débil.';
  if (code.includes('invalid-email')) return 'El correo no es válido.';
  return err.message || 'No pudimos crear la cuenta. Probá de nuevo.';
}

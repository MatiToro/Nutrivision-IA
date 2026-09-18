import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { GoogleIcon } from './LoginPage';

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', acceptedTerms: false,
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      await register({ email: form.email, password: form.password, displayName: form.name });
      navigate('/onboarding', { replace: true });
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
      await loginWithGoogle();
      navigate('/onboarding', { replace: true });
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

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-form__input">
            <User size={18} />
            <input
              type="text" autoComplete="name" placeholder="Nombre completo" required maxLength={100}
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
              type="password" autoComplete="new-password" placeholder="Contraseña" required minLength={6}
              aria-label="Contraseña"
              value={form.password} onChange={(e) => update('password', e.target.value)}
            />
          </div>

          <div className="auth-form__input">
            <Lock size={18} />
            <input
              type="password" autoComplete="new-password" placeholder="Repetir contraseña" required
              aria-label="Repetir contraseña"
              value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)}
            />
          </div>

          <p className="auth-form__hint">Mínimo 6 caracteres.</p>

          <label className="auth-form__terms">
            <input
              type="checkbox" checked={form.acceptedTerms}
              onChange={(e) => update('acceptedTerms', e.target.checked)}
            />
            <span>
              Acepto los <span className="auth-form__terms-link">Términos y Condiciones</span> y la{' '}
              <span className="auth-form__terms-link">Política de Privacidad</span>
            </span>
          </label>

          {error && <p className="field-error" role="alert">{error}</p>}

          <button type="submit" className="auth-form__submit" disabled={submitting}>
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-form__divider"><span>o</span></div>

        <button type="button" className="auth-form__outline-btn" onClick={handleGoogle} disabled={submitting}>
          <GoogleIcon /> Continuar con Google
        </button>

        <button type="button" className="auth-form__back" onClick={() => navigate('/login')}>
          <ArrowLeft size={15} /> Ya tengo cuenta, iniciar sesión
        </button>
      </div>
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

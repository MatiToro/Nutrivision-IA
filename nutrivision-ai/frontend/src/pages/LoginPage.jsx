import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const { login, loginWithGoogle, applyRememberMe, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '', rememberMe: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form);
      navigate(redirectTo, { replace: true });
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
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    if (!form.email) {
      setError('Escribí tu correo arriba primero, así sabemos a dónde mandarte el link.');
      return;
    }
    setResetting(true);
    try {
      await resetPassword(form.email);
      setResetSent(true);
    } catch (err) {
      setError(mapFirebaseError(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-form">
        <h2>Bienvenido de nuevo</h2>
        <p className="auth-form__subtitle">Iniciá sesión en tu cuenta</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-form__input">
            <Mail size={18} />
            <input
              type="email" autoComplete="email" placeholder="Correo electrónico" required
              aria-label="Correo electrónico"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="auth-form__input">
            <Lock size={18} />
            <input
              type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Contraseña" required minLength={6}
              aria-label="Contraseña"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button" className="auth-form__eye" onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="auth-form__forgot">
            <label className="auth-form__remember">
              <input
                type="checkbox"
                checked={form.rememberMe}
                onChange={(e) => {
                  setForm({ ...form, rememberMe: e.target.checked });
                  applyRememberMe(e.target.checked);
                }}
              />
              Recordarme
            </label>
            <button type="button" onClick={handleForgotPassword} disabled={resetting}>
              {resetting ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
            </button>
          </div>

          {resetSent && (
            <p className="message message--success">
              Te enviamos un correo a {form.email} con instrucciones para restablecerla.
            </p>
          )}
          {error && <p className="message" role="alert">{error}</p>}

          <button type="submit" className="auth-form__submit" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Iniciar sesión'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-form__divider"><span>o</span></div>

        <button type="button" className="auth-form__outline-btn" onClick={handleGoogle} disabled={submitting}>
          <GoogleIcon /> Continuar con Google
        </button>

        <p className="auth-form__footer">
          ¿No tenés cuenta?{' '}
          <button type="button" onClick={() => navigate('/register')}>Creá una</button>
        </p>
      </div>
    </AuthLayout>
  );
}

// Logo de Google en SVG
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C39.1 35.9 44 30.6 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function mapFirebaseError(err) {
  const code = err?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (code.includes('too-many-requests')) {
    return 'Demasiados intentos. Esperá un momento y probá de nuevo.';
  }
  return err.message || 'No pudimos completar la acción. Probá de nuevo.';
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import SessionError from '../components/SessionError';

/** Pantalla de inicio según el rol de la cuenta. */
export function homeFor(profile) {
  if (profile?.role === 'NUTRITIONIST') return '/nutri';
  if (profile?.role === 'ADMIN') return '/admin';
  return profile && !profile.onboardingCompleted ? '/onboarding' : '/dashboard';
}

/** Exige sesión iniciada. Si no, manda a /login conservando a dónde iba. */
export function RequireAuth() {
  const { isAuthenticated, loading, pendingRole, profile, sessionError } = useAuth();
  const location = useLocation();

  // También espera mientras se aplica el tipo de cuenta elegido al registrarse.
  if (loading || (pendingRole && profile?.role !== pendingRole)) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  // Sin perfil no se sabe el rol: se avisa en vez de mostrar la interfaz de paciente.
  if (!profile) return sessionError ? <SessionError /> : <LoadingScreen />;
  return <Outlet />;
}

/**
 * Cada rol tiene su propia interfaz: paciente (USER), nutricionista y administrador.
 * Si la cuenta entra a una sección de otro rol, se la lleva a su inicio.
 */
export function RequireRole({ role }) {
  const { profile } = useAuth();
  const current = profile?.role || 'USER';
  if (current !== role) return <Navigate to={homeFor(profile)} replace />;
  return <Outlet />;
}

/** Además de sesión, exige que el paciente ya haya completado el Formulario de Objetivos. */
export function RequireOnboarding() {
  const { isAuthenticated, onboardingCompleted, loading, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile && !onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** "/" → inicio de cada rol. */
export function HomeRedirect() {
  const { isAuthenticated, loading, profile, pendingRole, sessionError } = useAuth();
  if (loading || (pendingRole && profile?.role !== pendingRole)) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!profile) return sessionError ? <SessionError /> : <LoadingScreen />;
  return <Navigate to={homeFor(profile)} replace />;
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

/** Exige sesión iniciada. Si no, manda a /login conservando a dónde iba. */
export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

/** Además de sesión, exige que ya haya completado el Formulario de Objetivos. */
export function RequireOnboarding() {
  const { isAuthenticated, onboardingCompleted, loading, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Si el backend todavía no devolvió perfil (ej. no configurado en este
  // entorno demo), no bloqueamos: dejamos pasar para no trabar la demo.
  if (profile && !onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
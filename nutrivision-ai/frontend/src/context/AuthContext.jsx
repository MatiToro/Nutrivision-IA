import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  auth,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from '../api/firebase';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Tipo de cuenta elegido al registrarse ("Soy nutricionista"): mientras se aplica
  // en el backend, los guards muestran la carga en vez del onboarding de paciente.
  const [pendingRole, setPendingRole] = useState(null);
  // Hay sesión en Firebase pero el servidor no devolvió el perfil (sin conexión,
  // demasiados intentos, servidor caído). Mientras tanto no se muestra ninguna
  // interfaz de rol: los guards muestran un aviso con "Reintentar".
  const [sessionError, setSessionError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await apiClient.post('/auth/session');
      setProfile(data.user);
      setSessionError(null);
      return data.user;
    } catch (err) {
      setSessionError(err.message);
      throw err;
    }
  }, []);

  /** "Reintentar" desde el aviso de conexión. */
  const retrySession = useCallback(async () => {
    try {
      await fetchProfile();
    } catch {
      // No se hace nada: queda el aviso con "Reintentar" hasta que funcione.
    }
  }, [fetchProfile]);

  const refreshStreak = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/history/summary');
      setStreak(data.streak ?? 0);
    } catch {
      // No es crítico para el resto de la app si esto falla puntualmente.
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      // Nunca se muestra el perfil de otra cuenta.
      setProfile((prev) => (user && prev?.firebaseUid === user.uid ? prev : null));
      if (user) {
        try {
          await fetchProfile();
        } catch {
          // Queda `sessionError`: los guards muestran el aviso con "Reintentar"
          // en vez de tratar la cuenta como paciente.
        }
      } else {
        setProfile(null);
        setStreak(0);
        setSessionError(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [fetchProfile]);

  // Apenas hay un perfil con onboarding completo, traemos la racha real.
  useEffect(() => {
    if (profile?.onboardingCompleted && (!profile.role || profile.role === 'USER')) {
      refreshStreak();
    }
  }, [profile?.onboardingCompleted, profile?.role, refreshStreak]);

  // Aplica el tipo de cuenta elegido en el registro (solo cuentas nuevas, sin datos).
  const applyRole = useCallback(async (user, role) => {
    if (!role || role === 'USER' || user?.role === role) return user;
    const { data } = await apiClient.post('/users/me/role', { role });
    setProfile(data.user);
    return data.user;
  }, []);

  /** Cambia el tipo de cuenta (solo en cuentas nuevas, sin datos). */
  const changeRole = useCallback(async (role) => {
    const { data } = await apiClient.post('/users/me/role', { role });
    setProfile(data.user);
    return data.user;
  }, []);

  const registerAccount = useCallback(async ({ email, password, displayName, role }) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(credential.user, { displayName });
      // El token de sesión que ya tenía Firebase en memoria NO incluye
      // el nombre recién seteado — hay que forzar un refresco para que
      // el backend lo reciba en el próximo request y cree el usuario
      // con el nombre correcto (si no, queda guardado como "Sin nombre").
      await credential.user.getIdToken(true);
    }

    const user = await fetchProfile();

    // Red de seguridad: si por algún motivo el backend igual creó el
    // usuario sin nombre, lo corregimos con un segundo request explícito.
    let current = user;
    if (displayName && !user?.displayName) {
      const { data } = await apiClient.patch('/users/me', { displayName });
      setProfile(data.user);
      current = data.user;
    }
    await applyRole(current, role);
  }, [fetchProfile, applyRole]);

  const register = useCallback(async ({ email, password, displayName, role = 'USER' }) => {
    setError(null);
    if (role !== 'USER') setPendingRole(role);
    try {
      await registerAccount({ email, password, displayName, role });
    } catch (err) {
      // Si la cuenta se creó en Firebase pero el servidor falló, queda el aviso
      // con "Reintentar" (al reintentar, el servidor crea el perfil).
      if (auth.currentUser) setSessionError(err.message);
      throw err;
    } finally {
      setPendingRole(null);
    }
  }, [registerAccount]);


  // "Recordarme": si está tildado, la sesión persiste en este navegador
  // aunque lo cierres (browserLocalPersistence). Si no, se cierra sola
  // al cerrar la pestaña/navegador (browserSessionPersistence).
  const login = useCallback(async ({ email, password, rememberMe }) => {
    setError(null);
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
    try {
      await fetchProfile();
    } catch (err) {
      // Sin perfil no se entra: se cierra la sesión y el error se ve en el login.
      await signOut(auth);
      setSessionError(null);
      throw err;
    }
  }, [fetchProfile]);

  // Casilla "Recordarme": se aplica al tildarla/destildarla (antes de tocar
  // "Continuar con Google"), así la ventana de Google se abre sin demoras y
  // los navegadores no la bloquean.
  const applyRememberMe = useCallback((rememberMe) => (
    setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence).catch(() => {})
  ), []);

  // `role`: desde el Registro, el tipo de cuenta elegido antes de tocar "Continuar con Google".
  const loginWithGoogle = useCallback(async ({ role } = {}) => {
    setError(null);
    if (role && role !== 'USER') setPendingRole(role);
    try {
      await signInWithPopup(auth, googleProvider);
      let user;
      try {
        user = await fetchProfile();
      } catch (err) {
        await signOut(auth);
        setSessionError(null);
        throw err;
      }
      // Solo se aplica si la cuenta es nueva: una cuenta de Google que ya se usa
      // como paciente no se convierte (el backend lo rechaza).
      if (role && role !== 'USER' && user?.role === 'USER' && !user.onboardingCompleted) {
        await applyRole(user, role);
      }
    } finally {
      setPendingRole(null);
    }
  }, [fetchProfile, applyRole]);

  const resetPassword = useCallback(async (email) => {
    setError(null);
    await sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setStreak(0);
    setSessionError(null);
  }, []);

  const value = {
    firebaseUser,
    profile,
    setProfile,
    streak,
    refreshStreak,
    loading,
    error,
    setError,
    register,
    changeRole,
    pendingRole,
    sessionError,
    retrySession,
    role: profile?.role || 'USER',
    login,
    loginWithGoogle,
    applyRememberMe,
    resetPassword,
    logout,
    isAuthenticated: Boolean(firebaseUser),
    onboardingCompleted: Boolean(profile?.onboardingCompleted),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

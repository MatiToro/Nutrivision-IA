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
  const [profile, setProfile] = useState(null); // perfil de negocio (backend)
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await apiClient.post('/auth/session');
      setProfile(data.user);
      return data.user;
    } catch (err) {
      setProfile(null);
      throw err;
    }
  }, []);

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
      if (user) {
        try {
          await fetchProfile();
        } catch {
          // El backend no pudo validar la sesión (ej: no configurado
          // todavía en este entorno). No tumbamos la UI por eso.
        }
      } else {
        setProfile(null);
        setStreak(0);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [fetchProfile]);

  // Apenas hay un perfil con onboarding completo, traemos la racha real.
  useEffect(() => {
    if (profile?.onboardingCompleted) {
      refreshStreak();
    }
  }, [profile?.onboardingCompleted, refreshStreak]);

  const register = useCallback(async ({ email, password, displayName }) => {
    setError(null);
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
    if (displayName && !user?.displayName) {
      const { data } = await apiClient.patch('/users/me', { displayName });
      setProfile(data.user);
    }
  }, [fetchProfile]);

  // "Recordarme": si está tildado, la sesión persiste en este navegador
  // aunque lo cierres (browserLocalPersistence). Si no, se cierra sola
  // al cerrar la pestaña/navegador (browserSessionPersistence).
  const login = useCallback(async ({ email, password, rememberMe }) => {
    setError(null);
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile();
  }, [fetchProfile]);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    await signInWithPopup(auth, googleProvider);
    await fetchProfile();
  }, [fetchProfile]);

  const resetPassword = useCallback(async (email) => {
    setError(null);
    await sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setStreak(0);
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
    login,
    loginWithGoogle,
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

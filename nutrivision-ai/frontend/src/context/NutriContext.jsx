import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from './AuthContext';

/**
 * Datos de la cuenta de nutricionista (GET /api/nutritionist/me): estado de la
 * solicitud, perfil profesional, suscripción, códigos Premium y estadísticas.
 */
const NutriContext = createContext(null);

export function NutriProvider({ children }) {
  const { profile, setProfile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/nutritionist/me');
      setData(res);
      setError(null);
      return res;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const userId = profile?.id;
  useEffect(() => {
    if (userId) refresh();
  }, [userId, refresh]);

  const apply = useCallback((res) => {
    setData(res);
    setError(null);
    if (res?.user && profile && res.user.displayName !== profile.displayName) {
      setProfile({ ...profile, displayName: res.user.displayName });
    }
  }, [profile, setProfile]);

  const value = useMemo(() => ({
    data, error, loading: data === null && !error, refresh, apply,
  }), [data, error, refresh, apply]);

  return <NutriContext.Provider value={value}>{children}</NutriContext.Provider>;
}

export function useNutri() {
  const ctx = useContext(NutriContext);
  if (!ctx) throw new Error('useNutri debe usarse dentro de <NutriProvider>');
  return ctx;
}

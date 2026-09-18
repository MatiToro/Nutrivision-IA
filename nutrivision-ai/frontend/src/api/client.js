import axios from 'axios';
import { auth } from './firebase';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  timeout: 20000,
});

// Adjunta el ID token de Firebase vigente a cada request saliente.
// Nunca guardamos el token en localStorage: Firebase lo maneja en
// memoria/IndexedDB de forma segura y lo refresca automáticamente.
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Ocurrió un error de conexión. Probá de nuevo.';
    return Promise.reject(new Error(message));
  },
);

export default apiClient;
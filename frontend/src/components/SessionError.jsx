import { useState } from 'react';
import { LogOut, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Hay sesión iniciada pero el servidor no devolvió el perfil (sin conexión,
 * demasiados intentos seguidos, servidor caído). Como no se sabe el rol de la
 * cuenta, no se muestra ninguna interfaz: se ofrece reintentar o cerrar sesión.
 */
export default function SessionError() {
  const { sessionError, retrySession, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    await retrySession();
    setRetrying(false);
  }

  return (
    <div className="session-error" role="alert">
      <div className="card session-error__card">
        <span className="icon-tile icon-tile--danger"><WifiOff size={26} /></span>
        <h2>No pudimos conectar con el servidor</h2>
        <p>Tu sesión sigue iniciada, pero no pudimos cargar tu cuenta. Revisá tu conexión y probá de nuevo en unos segundos.</p>
        {sessionError ? <p className="session-error__detail">{sessionError}</p> : null}
        <div className="session-error__actions">
          <button type="button" className="btn btn-primary" onClick={retry} disabled={retrying}>
            <RefreshCw size={17} className={retrying ? 'session-error__spin' : undefined} /> {retrying ? 'Reintentando…' : 'Reintentar'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={logout} disabled={retrying}>
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </div>
      <style>{`
        .session-error { flex: 1; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--color-bg); }
        .session-error__card { max-width: 440px; width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 32px 26px; }
        .session-error__card h2 { margin: 6px 0 0; font-size: 1.25rem; }
        .session-error__card p { margin: 0; color: var(--color-ink-soft); line-height: 1.5; }
        .session-error__detail { font-size: 0.82rem; background: var(--color-bg); border-radius: var(--radius-md); padding: 8px 12px; }
        .session-error__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; margin-top: 10px; }
        .session-error__actions .btn { white-space: nowrap; }
        .session-error__spin { animation: spin 0.9s linear infinite; }
        @media (max-width: 420px) { .session-error__actions { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

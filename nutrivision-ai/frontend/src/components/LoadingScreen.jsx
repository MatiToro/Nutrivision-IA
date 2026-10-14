export default function LoadingScreen({ label = 'Cargando…' }) {
  return (
    <div className="loading-screen" role="status">
      <div className="loading-screen__logo">
        <img src="/logo.png" alt="" />
        <span className="loading-screen__ring" aria-hidden="true" />
      </div>
      <p>{label}</p>
      <style>{`
        .loading-screen {
          flex: 1; min-height: 60vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 14px;
        }
        .loading-screen__logo {
          position: relative; width: 84px; height: 84px; border-radius: 50%; background: var(--color-surface);
          box-shadow: var(--shadow-card); display: flex; align-items: center; justify-content: center;
        }
        .loading-screen__logo img { height: 50px; width: auto; }
        .loading-screen__ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 3px solid var(--color-primary-soft); border-top-color: var(--color-primary);
          animation: spin 0.9s linear infinite;
        }
        .loading-screen p { margin: 0; color: var(--color-ink-soft); font-weight: 600; font-size: 0.9rem; }
      `}
      </style>
    </div>
  );
}

export default function LoadingScreen({ label = 'Cargando…' }) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}
    >
      <div className="spinner" aria-hidden="true" />
      <p className="helper-text" style={{ margin: 0 }}>{label}</p>
      <style>{`
        .spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid var(--color-line);
          border-top-color: var(--color-primary);
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}
      </style>
    </div>
  );
}
import { APP_DOWNLOAD_URL, APP_QR_SRC } from '../constants/app';

export default function DownloadAppBanner() {
  return (
    <div className="download-banner">
      <div>
        <p className="eyebrow">La cámara vive en tu bolsillo</p>
        <h3>Escaneá tus platos en el momento con la app mobile</h3>
        <p className="helper-text" style={{ maxWidth: 440 }}>
          Esta versión web es ideal para revisar tu historial y cargar fotos guardadas.
          Para el escaneo en vivo, la heladera inteligente, las recetas con tu inventario
          y las rachas, descargá NutriVision AI en tu teléfono.
        </p>
        <div className="download-banner__stores">
          <a className="download-banner__store-badge" href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
            Descargar para Android (APK)
          </a>
        </div>
      </div>
      <img src={APP_QR_SRC} alt="Código QR para descargar NutriVision IA para Android" width={132} height={132} />

      <style>{`
        .download-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          background: var(--color-primary-soft);
          border: 1px solid var(--color-primary);
          border-radius: var(--radius-lg);
          padding: 24px 28px;
          flex-wrap: wrap;
        }
        .download-banner h3 { margin: 4px 0 8px; font-size: 1.25rem; }
        .download-banner__stores { display: flex; gap: 8px; margin-top: 14px; }
        .download-banner__store-badge {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          border: 1px solid var(--color-primary);
          color: var(--color-primary);
          border-radius: 999px;
          padding: 5px 12px;
          text-decoration: none;
        }
        .download-banner img { border-radius: 10px; background: white; padding: 6px; }
      `}
      </style>
    </div>
  );
}
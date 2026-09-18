import { Smartphone, Apple, PlayCircle, Camera, Zap, ShieldCheck } from 'lucide-react';

const APP_URL = 'nutrivision.ai/app'; // reemplazar por el link real cuando exista

const FEATURES = [
  { Icon: Camera, title: 'Escaneo con IA', desc: 'Fotografiá tu plato y obtené macros y calorías en segundos.' },
  { Icon: Zap, title: 'Seguimiento en tiempo real', desc: 'Registrá cada comida y llevá el control de tus metas diarias.' },
  { Icon: ShieldCheck, title: 'Coach nutricional IA', desc: 'Recibí feedback personalizado según tu objetivo y progreso.' },
  { Icon: Smartphone, title: 'Funciones exclusivas', desc: 'Cámara en vivo, heladera inteligente, recetas y rachas — pensadas para el momento de cocinar.' },
];

export default function DownloadAppPage() {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&color=17191C&bgcolor=FFFFFF&data=${encodeURIComponent(`https://${APP_URL}`)}`;

  function copyLink() {
    navigator.clipboard?.writeText(`https://${APP_URL}`);
  }

  return (
    <div className="container download-page">
      <div className="download-page__header">
        <h1>Descargar la App</h1>
        <p className="helper-text">NutriVision AI en tu bolsillo — disponible para iOS y Android</p>
      </div>

      <div className="download-page__grid">
        {/* Columna izquierda */}
        <div className="download-page__left">
          <div className="download-page__hero">
            <div className="download-page__hero-blob download-page__hero-blob--a" />
            <div className="download-page__hero-blob download-page__hero-blob--b" />
            <div className="download-page__hero-content">
              <div className="download-page__hero-top">
                <span className="download-page__hero-icon"><img src="/logo.png" alt="" /></span>
                <div>
                  <h2>NutriVision AI</h2>
                  <p>Coach Nutricional con IA</p>
                </div>
              </div>
              <p className="download-page__hero-desc">
                Transformá tu relación con la comida. Escaneá tu plato, conocé tus macros y alcanzá
                tus objetivos — todo desde tu teléfono.
              </p>
              <span className="download-page__hero-badge">Disponible ahora</span>
            </div>
          </div>

          <div className="download-page__features">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div className="card download-page__feature" key={title}>
                <div className="download-page__feature-icon"><Icon size={19} /></div>
                <h3>{title}</h3>
                <p className="helper-text">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="download-page__right">
          <div className="card download-page__qr-card">
            <div className="download-page__qr-icon"><Smartphone size={19} /></div>
            <h3>Escaneá y descargá</h3>
            <p className="helper-text">Apuntá la cámara de tu teléfono al código para ir directo a la tienda.</p>
            <div className="download-page__qr-wrap">
              <img src={qrSrc} alt="Código QR de acceso a NutriVision AI mobile" width={150} height={150} />
            </div>

            <div className="download-page__divider"><span>o descargá directo</span></div>

            <div className="download-page__store-buttons">
              <button type="button" className="download-page__store-btn">
                <Apple size={22} />
                <span className="download-page__store-btn-text">
                  <span>Descargar en</span>
                  <strong>App Store</strong>
                </span>
              </button>
              <button type="button" className="download-page__store-btn">
                <PlayCircle size={22} />
                <span className="download-page__store-btn-text">
                  <span>Descargar en</span>
                  <strong>Google Play</strong>
                </span>
              </button>
            </div>
            <p className="helper-text download-page__requirements">Gratis · Requiere iOS 15+ o Android 8+</p>
          </div>

          <div className="card download-page__share">
            <h3>Compartir link de descarga</h3>
            <div className="download-page__share-row">
              <div className="download-page__share-url mono-num">{APP_URL}</div>
              <button type="button" className="btn btn-primary" onClick={copyLink}>Copiar</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .download-page { padding: 32px 24px 64px; }
        .download-page__header { margin-bottom: 24px; }
        .download-page__header h1 { margin: 0 0 2px; }
        .download-page__grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 940px) { .download-page__grid { grid-template-columns: 1fr; } }

        .download-page__left { display: flex; flex-direction: column; gap: 20px; }

        .download-page__hero {
          position: relative; overflow: hidden; background: var(--gradient-primary);
          border-radius: var(--radius-lg); padding: 30px; color: #fff;
        }
        .download-page__hero-blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.12); }
        .download-page__hero-blob--a { width: 190px; height: 190px; right: -50px; top: -50px; }
        .download-page__hero-blob--b { width: 130px; height: 130px; right: -10px; bottom: 10px; }
        .download-page__hero-content { position: relative; z-index: 1; }
        .download-page__hero-top { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
        .download-page__hero-icon {
          width: 56px; height: 56px; border-radius: var(--radius-md); background: #fff;
          border: 1px solid rgba(255,255,255,0.3); overflow: hidden; flex-shrink: 0;
        }
        .download-page__hero-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .download-page__hero-top h2 { margin: 0; font-size: 1.4rem; }
        .download-page__hero-top p { margin: 0; opacity: 0.8; font-size: 0.88rem; }
        .download-page__hero-desc { max-width: 440px; font-size: 1.02rem; opacity: 0.92; margin-bottom: 16px; }
        .download-page__hero-badge {
          display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 999px;
          font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        }

        .download-page__features { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .download-page__feature { padding: 18px; }
        .download-page__feature-icon {
          width: 38px; height: 38px; border-radius: var(--radius-sm); background: var(--color-primary-soft);
          color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 10px;
        }
        .download-page__feature h3 { margin: 0 0 4px; font-size: 0.92rem; }
        .download-page__feature p { margin: 0; }

        .download-page__right { display: flex; flex-direction: column; gap: 16px; }
        .download-page__qr-card { padding: 26px; text-align: center; }
        .download-page__qr-icon {
          width: 40px; height: 40px; border-radius: var(--radius-sm); background: var(--color-primary-soft); color: var(--color-primary);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
        }
        .download-page__qr-card h3 { margin: 0 0 4px; font-size: 1.05rem; }
        .download-page__qr-wrap { display: flex; justify-content: center; margin: 18px 0; }
        .download-page__qr-wrap img { border-radius: var(--radius-md); border: 2px solid var(--color-line); }
        .download-page__divider { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; color: var(--color-ink-soft); font-size: 0.76rem; }
        .download-page__divider::before, .download-page__divider::after { content: ''; flex: 1; height: 1px; background: var(--color-line); }
        .download-page__store-buttons { display: flex; flex-direction: column; gap: 10px; }
        .download-page__store-btn {
          display: flex; align-items: center; gap: 12px; width: 100%; background: var(--color-ink); color: #fff;
          border: none; border-radius: var(--radius-md); padding: 13px 16px; cursor: pointer; transition: transform 0.1s ease;
        }
        .download-page__store-btn:hover { transform: scale(1.02); }
        .download-page__store-btn-text { display: flex; flex-direction: column; align-items: flex-start; font-size: 0.78rem; line-height: 1.3; }
        .download-page__store-btn-text strong { font-size: 0.92rem; }
        .download-page__requirements { margin: 12px 0 0; }

        .download-page__share { padding: 22px; }
        .download-page__share h3 { margin: 0 0 12px; font-size: 0.95rem; }
        .download-page__share-row { display: flex; gap: 8px; }
        .download-page__share-url {
          flex: 1; background: var(--color-bg); border: 1px solid var(--color-line); border-radius: var(--radius-sm);
          padding: 11px 14px; font-size: 0.85rem; color: var(--color-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
      `}
      </style>
    </div>
  );
}

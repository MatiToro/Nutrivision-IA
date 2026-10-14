import { Smartphone, Apple, PlayCircle, Camera, Zap, ShieldCheck } from 'lucide-react';
import { PageTitle } from '../components/ui';

const APP_URL = 'nutrivision.ai/app'; // reemplazar por el link real cuando exista

const FEATURES = [
  { Icon: Camera, title: 'Escaneo con IA', desc: 'Fotografiá tu plato y obtené macros y calorías en segundos.' },
  { Icon: Zap, title: 'Seguimiento en tiempo real', desc: 'Registrá cada comida y llevá el control de tus metas diarias.', tone: 'water' },
  { Icon: ShieldCheck, title: 'Coach nutricional IA', desc: 'Recibí feedback personalizado según tu objetivo y progreso.', tone: 'violet' },
  { Icon: Smartphone, title: 'Funciones exclusivas', desc: 'Cámara en vivo, heladera inteligente, recetas y rachas — pensadas para el momento de cocinar.', tone: 'accent' },
];

export default function DownloadAppPage() {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&color=17191C&bgcolor=FFFFFF&data=${encodeURIComponent(`https://${APP_URL}`)}`;

  function copyLink() {
    navigator.clipboard?.writeText(`https://${APP_URL}`);
  }

  return (
    <div className="page download-page">
      <PageTitle title="Descargar la app" subtitle="NutriVision IA en tu bolsillo — disponible para iOS y Android." />

      <div className="download-page__grid">
        {/* Columna izquierda */}
        <div className="download-page__left">
          <section className="download-page__hero">
            <span className="download-page__blob download-page__blob--a" />
            <span className="download-page__blob download-page__blob--b" />
            <div className="download-page__hero-top">
              <span className="download-page__hero-logo"><img src="/logo.png" alt="" /></span>
              <div>
                <h2>NutriVision IA</h2>
                <p>Coach nutricional con IA</p>
              </div>
            </div>
            <p className="download-page__hero-desc">
              Transformá tu relación con la comida. Escaneá tu plato, conocé tus macros y alcanzá
              tus objetivos — todo desde tu teléfono.
            </p>
            <span className="badge badge--light">Disponible ahora</span>
          </section>

          <div className="download-page__features">
            {FEATURES.map(({ Icon, title, desc, tone }) => (
              <div className="card download-page__feature" key={title}>
                <span className={`icon-tile${tone ? ` icon-tile--${tone}` : ''}`}><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="download-page__right">
          <section className="card download-page__qr-card">
            <h3>Escaneá y descargá</h3>
            <p className="hint">Apuntá la cámara de tu teléfono al código para ir directo a la tienda.</p>
            <div className="download-page__qr-wrap">
              <img src={qrSrc} alt="Código QR de acceso a NutriVision IA mobile" width={150} height={150} />
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
            <p className="hint download-page__requirements">Gratis · Requiere iOS 15+ o Android 8+</p>
          </section>

          <section className="card">
            <div className="section-header"><h3>Compartir link de descarga</h3></div>
            <div className="download-page__share-row">
              <div className="download-page__share-url">{APP_URL}</div>
              <button type="button" className="pill-btn pill-btn--solid" onClick={copyLink}>Copiar</button>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .download-page__grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 960px) { .download-page__grid { grid-template-columns: 1fr; gap: 16px; } }
        .download-page__left, .download-page__right { display: flex; flex-direction: column; gap: 16px; }

        .download-page__hero {
          position: relative; overflow: hidden; background: var(--gradient-primary); color: #fff;
          border-radius: var(--radius-lg); padding: 26px; box-shadow: var(--shadow-card);
        }
        .download-page__blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.1); pointer-events: none; }
        .download-page__blob--a { width: 200px; height: 200px; right: -50px; top: -60px; }
        .download-page__blob--b { width: 120px; height: 120px; right: 60px; bottom: -50px; }
        .download-page__hero-top { position: relative; display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        .download-page__hero-logo {
          width: 64px; height: 64px; border-radius: 50%; background: #fff; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,0.12);
        }
        .download-page__hero-logo img { height: 44px; width: auto; }
        .download-page__hero-top h2 { margin: 0; color: #fff; font-size: 1.4rem; }
        .download-page__hero-top p { margin: 0; opacity: 0.85; font-size: 0.9rem; }
        .download-page__hero-desc { position: relative; max-width: 440px; font-size: 1rem; opacity: 0.94; margin: 0 0 14px; }

        .download-page__features { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 520px) { .download-page__features { grid-template-columns: 1fr; } }
        .download-page__feature { display: flex; flex-direction: column; gap: 4px; }
        .download-page__feature .icon-tile { margin-bottom: 8px; }
        .download-page__feature h3 { margin: 0; font-size: 0.98rem; }
        .download-page__feature p { margin: 0; color: var(--color-ink-soft); font-size: 0.86rem; }

        .download-page__qr-card { text-align: center; }
        .download-page__qr-card h3 { margin: 0 0 4px; }
        .download-page__qr-wrap {
          display: flex; justify-content: center; margin: 16px auto; padding: 12px; width: fit-content;
          background: var(--color-primary-soft); border-radius: var(--radius-lg);
        }
        .download-page__qr-wrap img { border-radius: var(--radius-md); display: block; }
        .download-page__divider { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; color: var(--color-ink-muted); font-size: 0.78rem; font-weight: 600; }
        .download-page__divider::before, .download-page__divider::after { content: ''; flex: 1; height: 1px; background: var(--color-line); }
        .download-page__store-buttons { display: flex; flex-direction: column; gap: 10px; }
        .download-page__store-btn {
          display: flex; align-items: center; gap: 12px; width: 100%; background: var(--color-ink); color: #fff;
          border: none; border-radius: var(--radius-md); padding: 12px 16px; cursor: pointer; transition: transform 0.1s ease;
        }
        .download-page__store-btn:hover { transform: translateY(-1px); }
        .download-page__store-btn-text { display: flex; flex-direction: column; align-items: flex-start; font-size: 0.76rem; line-height: 1.3; }
        .download-page__store-btn-text strong { font-size: 0.95rem; font-weight: 800; }
        .download-page__requirements { margin-top: 12px; }

        .download-page__share-row { display: flex; gap: 8px; align-items: center; }
        .download-page__share-url {
          flex: 1; min-width: 0; background: var(--color-bg); border-radius: var(--radius-md);
          padding: 10px 14px; font-size: 0.88rem; font-weight: 600; color: var(--color-ink-soft);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
      `}
      </style>
    </div>
  );
}

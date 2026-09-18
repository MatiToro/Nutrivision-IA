import { Camera, BarChart3, Target } from 'lucide-react';

const FEATURES = [
  { Icon: Camera, line1: 'Escaneá', line2: 'tu plato' },
  { Icon: BarChart3, line1: 'Calculá tus', line2: 'macros' },
  { Icon: Target, line1: 'Seguí tu', line2: 'progreso' },
];

export default function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__hero">
        <div className="auth-layout__hero-overlay" />

        <div className="auth-layout__hero-content">
          <div className="auth-layout__brand">
            <img src="/logo.png" alt="" className="auth-layout__brand-logo" />
            <span>NutriVision IA</span>
          </div>

          <div className="auth-layout__headline">
            <h1>Comé mejor,<br />lográ tus objetivos.</h1>
            <p>Escaneá tus comidas, conocé tus macros y seguí tu progreso, todo en un solo lugar.</p>
          </div>

          <div className="auth-layout__features">
            {FEATURES.map(({ Icon, line1, line2 }) => (
              <div className="auth-layout__feature" key={line1}>
                <Icon size={24} strokeWidth={1.6} />
                <span>{line1}<br />{line2}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-layout__panel">
        <div className="auth-layout__card">
          <div className="auth-layout__card-brand">
            <img src="/logo.png" alt="" />
            <p>Nutri<span>Vision IA</span></p>
          </div>
          {children}
        </div>
      </div>

      <style>{`
        .auth-layout {
          flex: 1; display: grid; grid-template-columns: 1fr 1fr;
          min-height: 100vh; background: #F2F5F4; padding: 28px; gap: 0;
        }

        .auth-layout__hero {
          position: relative; overflow: hidden; border-radius: 22px 0 0 22px;
          background-image: url('/auth-hero.jpg'); background-size: cover; background-position: center;
        }
        .auth-layout__hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(120deg, rgba(14,90,52,0.94) 0%, rgba(20,110,62,0.86) 42%, rgba(24,130,72,0.42) 100%);
        }
        .auth-layout__hero-content {
          position: relative; z-index: 1; height: 100%;
          display: flex; flex-direction: column; padding: 46px 48px;
        }

        .auth-layout__brand { display: flex; align-items: center; gap: 12px; }
        .auth-layout__brand-logo {
          width: 42px; height: 42px; border-radius: 11px; object-fit: cover; flex-shrink: 0;
          background: #fff;
        }
        .auth-layout__brand span { color: #fff; font-size: 1.45rem; font-weight: 700; letter-spacing: -0.01em; }

        .auth-layout__headline { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .auth-layout__headline h1 {
          margin: 0 0 22px; color: #fff; font-size: 2.9rem; line-height: 1.12;
          font-weight: 400; font-style: italic; font-family: var(--font-display);
        }
        .auth-layout__headline p {
          margin: 0; color: rgba(255,255,255,0.93); font-size: 1.02rem; line-height: 1.65;
          max-width: 330px; font-weight: 500;
        }

        .auth-layout__features { display: flex; align-items: center; gap: 26px; }
        .auth-layout__feature {
          display: flex; align-items: center; gap: 11px; color: #fff; flex: 1;
        }
        .auth-layout__feature + .auth-layout__feature {
          border-left: 1px solid rgba(255,255,255,0.28); padding-left: 26px;
        }
        .auth-layout__feature svg { flex-shrink: 0; }
        .auth-layout__feature span { font-size: 0.88rem; line-height: 1.35; font-weight: 500; }

        .auth-layout__panel {
          display: flex; align-items: center; justify-content: center;
          background: #F2F5F4; border-radius: 0 22px 22px 0; padding: 40px 32px; overflow-y: auto;
        }
        .auth-layout__card {
          width: 100%; max-width: 420px; background: #FBFCFC;
          border-radius: 20px; padding: 42px 40px;
          box-shadow: 0 4px 30px rgba(20, 60, 40, 0.07);
        }
        .auth-layout__card-brand { text-align: center; margin-bottom: 26px; }
        .auth-layout__card-brand img {
          width: 52px; height: 52px; border-radius: 13px; object-fit: cover; margin-bottom: 10px;
        }
        .auth-layout__card-brand p {
          margin: 0; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; color: var(--color-ink);
        }
        .auth-layout__card-brand span { color: var(--color-primary); }

        @media (max-width: 980px) {
          .auth-layout { grid-template-columns: 1fr; padding: 0; }
          .auth-layout__hero { display: none; }
          .auth-layout__panel { border-radius: 0; min-height: 100vh; }
        }
      `}
      </style>
    </div>
  );
}

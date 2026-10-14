import { Camera, BarChart3, Target } from 'lucide-react';

const FEATURES = [
  { Icon: Camera, label: 'Escaneá tu plato' },
  { Icon: BarChart3, label: 'Calculá tus macros' },
  { Icon: Target, label: 'Seguí tu progreso' },
];

/**
 * Contenedor de Login / Registro, igual que en la app mobile:
 * encabezado verde con el logo en un círculo blanco y una tarjeta
 * blanca que se superpone.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__hero">
        <span className="auth-layout__blob auth-layout__blob--a" />
        <span className="auth-layout__blob auth-layout__blob--b" />
        <div className="auth-layout__logo">
          <img src="/logo.png" alt="Logo de NutriVision IA" />
        </div>
        <p className="auth-layout__brand">NutriVision IA</p>
        <p className="auth-layout__tagline">Tu nutrición, con una foto.</p>
      </div>

      <div className="auth-layout__card">{children}</div>

      <ul className="auth-layout__features">
        {FEATURES.map(({ Icon, label }) => (
          <li key={label}>
            <span className="icon-tile"><Icon size={18} /></span>
            {label}
          </li>
        ))}
      </ul>

      <style>{`
        .auth-layout { flex: 1; min-height: 100vh; background: var(--color-bg); display: flex; flex-direction: column; align-items: center; padding-bottom: 32px; }

        .auth-layout__hero {
          position: relative; overflow: hidden; width: 100%;
          background: var(--gradient-primary); border-radius: 0 0 40px 40px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding: 44px 20px 92px;
        }
        .auth-layout__blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.08); pointer-events: none; }
        .auth-layout__blob--a { width: 340px; height: 340px; left: -120px; top: -160px; }
        .auth-layout__blob--b { width: 260px; height: 260px; right: -80px; bottom: -150px; }
        .auth-layout__logo {
          position: relative; width: 92px; height: 92px; border-radius: 50%; background: #fff;
          display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 26px rgba(0,0,0,0.14);
        }
        .auth-layout__logo img { height: 66px; width: auto; }
        .auth-layout__brand { position: relative; margin: 14px 0 0; color: #fff; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; }
        .auth-layout__tagline { position: relative; margin: 2px 0 0; color: #fff; opacity: 0.88; font-size: 0.98rem; }

        .auth-layout__card {
          position: relative; width: calc(100% - 32px); max-width: 460px; margin-top: -60px;
          background: var(--color-surface); border-radius: var(--radius-xl); padding: 28px 26px;
          box-shadow: 0 10px 30px rgba(23,25,28,0.08);
        }

        .auth-layout__features {
          list-style: none; margin: 24px 0 0; padding: 0 16px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;
        }
        .auth-layout__features li {
          display: flex; align-items: center; gap: 8px; background: var(--color-surface); border-radius: 999px;
          padding: 6px 14px 6px 6px; font-size: 0.84rem; font-weight: 700; color: var(--color-ink); box-shadow: var(--shadow-soft);
        }
        .auth-layout__features .icon-tile { width: 30px; height: 30px; border-radius: 50%; }

        @media (max-width: 520px) {
          .auth-layout__hero { padding: 32px 20px 80px; border-radius: 0 0 32px 32px; }
          .auth-layout__card { padding: 22px 18px; }
        }
      `}
      </style>
    </div>
  );
}

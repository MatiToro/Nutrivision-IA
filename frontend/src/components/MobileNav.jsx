import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ScanLine, Flame, Download, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navFor } from './navConfig';
import Portal from './Portal';

/**
 * Navegación para pantallas chicas, igual a la app mobile:
 * encabezado con logo + racha arriba y barra inferior con el botón
 * central flotante que lleva directo al escáner.
 */
export default function MobileNav() {
  const { streak, role, logout } = useAuth();
  const nav = navFor(role);
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await logout();
    navigate('/login');
  }

  return (
    <>
      <header className="mobile-header">
        <Link to={nav.home} className="mobile-header__brand">
          <img src="/logo.png" alt="" />
          <span>NutriVision <em>IA</em></span>
        </Link>
        <div className="mobile-header__right">
          <Link to="/download" className="mobile-header__icon" aria-label="Descargar app">
            <Download size={17} />
          </Link>
          {nav.streak ? (
            <span className="mobile-header__streak" aria-label={`Racha de ${streak} días`}>
              <Flame size={16} color={streak > 0 ? '#F97316' : '#9AA0A8'} fill={streak > 0 ? '#FDBA74' : 'transparent'} />
              {streak}
            </span>
          ) : (
            // Nutricionista y admin: cerrar sesión (el paciente lo tiene en su Perfil)
            <button type="button" className="mobile-header__icon" onClick={() => setShowLogoutConfirm(true)} aria-label="Cerrar sesión">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Misma confirmación que la barra lateral */}
      {showLogoutConfirm && (
        <Portal>
          <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <div className="modal-panel confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <span className="icon-tile icon-tile--danger"><LogOut size={26} /></span>
              <h3>¿Cerrar sesión?</h3>
              <p>Vas a salir de tu cuenta. Podés volver a ingresar cuando quieras.</p>
              <div className="confirm-modal__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>Cancelar</button>
                <button type="button" className="btn btn-danger" onClick={handleLogout}>Sí, salir</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      <nav className="tabbar" aria-label="Navegación principal">
        {nav.tabs.map(({ to, label, icon: Icon, center, end }) => (
          center ? (
            <NavLink key={to} to={to} className={({ isActive }) => `tabbar__center${isActive ? ' is-active' : ''}`} aria-label="Escanear plato">
              <span className="tabbar__center-btn"><ScanLine size={27} strokeWidth={2.4} /></span>
              <span className="tabbar__label">{label}</span>
            </NavLink>
          ) : (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tabbar__tab${isActive ? ' is-active' : ''}`}>
              <span className="tabbar__pill"><Icon size={21} /></span>
              <span className="tabbar__label">{label}</span>
            </NavLink>
          )
        ))}
      </nav>

      <style>{`
        .mobile-header, .tabbar { display: none; }
        @media (max-width: 900px) {
          .mobile-header {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            padding: 14px 16px 4px; position: sticky; top: 0; z-index: 30;
            background: linear-gradient(var(--color-bg) 75%, rgba(246,247,249,0));
          }
          .mobile-header__brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--color-ink); }
          .mobile-header__brand img { width: auto; height: 38px; }
          .mobile-header__brand span { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; }
          .mobile-header__brand em { font-style: normal; color: var(--color-primary); }
          .mobile-header__right { display: flex; align-items: center; gap: 8px; }
          .mobile-header__icon, .mobile-header__streak {
            display: inline-flex; align-items: center; justify-content: center; gap: 4px;
            background: var(--color-surface); border-radius: 999px; box-shadow: var(--shadow-card);
            font-weight: 800; font-size: 0.9rem; color: var(--color-ink); text-decoration: none;
          }
          .mobile-header__icon { width: 36px; height: 36px; color: var(--color-primary); border: none; cursor: pointer; }
          .mobile-header__streak { padding: 7px 12px; }

          .tabbar {
            display: flex; align-items: flex-end; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
            background: var(--color-surface); border-radius: 24px 24px 0 0; padding: 8px 6px 10px;
            box-shadow: 0 -4px 16px rgba(23,25,28,0.08);
          }
          .tabbar__tab, .tabbar__center {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 2px;
            text-decoration: none; color: var(--color-ink-muted);
          }
          .tabbar__pill { padding: 4px 16px; border-radius: 999px; display: flex; transition: background 0.12s ease; }
          .tabbar__label { font-size: 0.7rem; font-weight: 600; }
          .tabbar__tab.is-active, .tabbar__center.is-active { color: var(--color-primary); }
          .tabbar__tab.is-active .tabbar__pill { background: var(--color-primary-soft); }
          .tabbar__tab.is-active .tabbar__label, .tabbar__center.is-active .tabbar__label { font-weight: 800; }
          .tabbar__center-btn {
            margin-top: -34px; width: 72px; height: 72px; border-radius: 50%; border: 5px solid var(--color-surface);
            background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center;
            box-shadow: var(--shadow-float); transition: transform 0.1s ease;
          }
          .tabbar__center:active .tabbar__center-btn { transform: scale(0.95); }
        }
      `}
      </style>
    </>
  );
}

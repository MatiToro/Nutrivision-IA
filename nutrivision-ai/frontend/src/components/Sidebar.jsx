import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Flame, ScanLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navFor } from './navConfig';
import Portal from './Portal';

/** Menú lateral de escritorio. En pantallas chicas se reemplaza por MobileNav. */
export default function Sidebar() {
  const { profile, firebaseUser, logout, streak, role } = useAuth();
  const nav = navFor(role);
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const nameForInitials = profile?.displayName || firebaseUser?.email || '?';
  const initials = nameForInitials
    .trim()
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="/logo.png" alt="" className="sidebar__brand-mark" />
        <p className="sidebar__brand-name">NutriVision <span>IA</span></p>
      </div>

      {nav.scan ? (
      <NavLink to="/scan" className={({ isActive }) => `sidebar__scan${isActive ? ' is-active' : ''}`}>
        <span className="sidebar__scan-icon"><ScanLine size={20} strokeWidth={2.4} /></span>
        <span>
          <strong>Escanear plato</strong>
          <small>Macros al instante con IA</small>
        </span>
      </NavLink>
      ) : (
        <p className="sidebar__role">{role === 'ADMIN' ? 'Administración' : 'Panel del nutricionista'}</p>
      )}

      <nav className="sidebar__nav" aria-label="Navegación principal">
        {nav.links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
          >
            <span className="sidebar__link-icon"><Icon size={19} /></span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {nav.streak ? (
      <div className="sidebar__streak" aria-label={`Racha de ${streak} días`}>
        <span className="sidebar__streak-icon" aria-hidden="true">
          <Flame size={18} fill={streak > 0 ? '#FDBA74' : 'transparent'} />
        </span>
        <div>
          <p className="sidebar__streak-value">{streak} {streak === 1 ? 'día' : 'días'}</p>
          <p className="sidebar__streak-label">Racha activa</p>
        </div>
      </div>
      ) : null}

      <button type="button" className="sidebar__user" onClick={() => setShowLogoutConfirm(true)} title="Cerrar sesión">
        {profile?.photoUrl ? (
          <img src={profile.photoUrl} alt="" className="sidebar__user-photo" />
        ) : (
          <span className="avatar-circle">{initials}</span>
        )}
        <span className="sidebar__user-info">
          <span className="sidebar__user-name">{profile?.displayName || 'Mi cuenta'}</span>
          <span className="sidebar__user-email">{firebaseUser?.email}</span>
        </span>
        <LogOut size={17} className="sidebar__logout-icon" aria-hidden="true" />
      </button>

      {showLogoutConfirm && (
        <Portal>
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-panel confirm-modal" onClick={(e) => e.stopPropagation()}>
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

      <style>{`
        .sidebar {
          width: var(--sidebar-width); flex-shrink: 0; background: var(--color-surface);
          box-shadow: 1px 0 0 var(--color-line);
          display: flex; flex-direction: column; gap: 6px;
          padding: 22px 16px 18px; position: sticky; top: 0; height: 100vh; overflow-y: auto;
        }
        .sidebar__brand { display: flex; align-items: center; gap: 10px; padding: 2px 8px 16px; }
        .sidebar__brand-mark { width: auto; height: 42px; object-fit: contain; flex-shrink: 0; }
        .sidebar__brand-name { margin: 0; font-weight: 800; font-size: 1.12rem; letter-spacing: -0.02em; line-height: 1.2; }
        .sidebar__brand-name span { color: var(--color-primary); }

        .sidebar__scan {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 14px;
          background: var(--gradient-primary); color: #fff; border-radius: 18px; text-decoration: none;
          box-shadow: var(--shadow-float); transition: filter 0.15s ease, transform 0.1s ease;
        }
        .sidebar__scan:hover { filter: brightness(1.06); }
        .sidebar__scan:active { transform: scale(0.98); }
        .sidebar__scan.is-active { box-shadow: 0 0 0 3px var(--color-primary-soft), var(--shadow-float); }
        .sidebar__scan-icon {
          width: 40px; height: 40px; border-radius: 13px; background: rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .sidebar__scan strong { display: block; font-size: 0.95rem; font-weight: 800; }
        .sidebar__scan small { display: block; font-size: 0.74rem; opacity: 0.88; }

        .sidebar__nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .sidebar__role {
          margin: 0 8px 10px; padding: 8px 12px; border-radius: 12px; background: var(--color-primary-soft);
          color: var(--color-primary-dark); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .sidebar__link {
          display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 14px;
          color: var(--color-ink-soft); text-decoration: none; font-weight: 600; font-size: 0.93rem;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .sidebar__link-icon {
          width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
          color: var(--color-ink-muted); transition: background 0.12s ease, color 0.12s ease;
        }
        .sidebar__link:hover { background: var(--color-bg); color: var(--color-ink); }
        .sidebar__link--active, .sidebar__link--active:hover { background: var(--color-primary-soft); color: var(--color-primary-dark); font-weight: 800; }
        .sidebar__link--active .sidebar__link-icon { background: var(--color-surface); color: var(--color-primary); box-shadow: var(--shadow-soft); }

        .sidebar__streak {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin: 10px 0 6px;
          border-radius: 16px; background: var(--color-streak-soft);
        }
        .sidebar__streak-icon {
          width: 34px; height: 34px; border-radius: 50%; background: var(--color-surface); color: var(--color-streak);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-soft);
        }
        .sidebar__streak-value { margin: 0; font-weight: 800; font-size: 0.9rem; color: #9A3412; }
        .sidebar__streak-label { margin: 0; font-size: 0.74rem; color: #B45309; font-weight: 600; }

        .sidebar__user {
          display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 16px;
          border: none; background: var(--color-bg); cursor: pointer; text-align: left; width: 100%;
          transition: background 0.12s ease;
        }
        .sidebar__user:hover { background: var(--color-danger-soft); }
        .sidebar__user:hover .sidebar__logout-icon { color: var(--color-danger); }
        .sidebar__user-photo { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .sidebar__user-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .sidebar__user-name { font-size: 0.86rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar__user-email { font-size: 0.74rem; color: var(--color-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar__logout-icon { color: var(--color-ink-muted); flex-shrink: 0; transition: color 0.12s ease; }

        @media (max-width: 900px) { .sidebar { display: none; } }
      `}
      </style>
    </aside>
  );
}

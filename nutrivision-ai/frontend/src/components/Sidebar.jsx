import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Camera, Clock, User, Download, LogOut, Flame, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/dashboard', label: 'Inicio', icon: Home },
  { to: '/scan', label: 'Escáner IA', icon: Camera },
  { to: '/history', label: 'Historial', icon: Clock },
  { to: '/profile', label: 'Perfil', icon: User },
  { to: '/download', label: 'Descargar app', icon: Download },
  { to: '/pricing', label: 'Precios', icon: Tag },
];

export default function Sidebar() {
  const { profile, firebaseUser, logout, streak } = useAuth();
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
        <img src="/logo.png" alt="NutriVision IA" className="sidebar__brand-mark" />
        <p className="sidebar__brand-name">NutriVision IA</p>
      </div>

      <nav className="sidebar__nav" aria-label="Navegación principal">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__streak">
        <span className="sidebar__streak-icon" aria-hidden="true"><Flame size={17} /></span>
        <div>
          <p className="sidebar__streak-value">{streak} {streak === 1 ? 'día' : 'días'}</p>
          <p className="sidebar__streak-label">Racha activa</p>
        </div>
      </div>

      <button type="button" className="sidebar__user" onClick={() => setShowLogoutConfirm(true)}>
        <span className="avatar-circle">{initials}</span>
        <span className="sidebar__user-info">
          <span className="sidebar__user-name">{profile?.displayName || 'Mi cuenta'}</span>
          <span className="sidebar__user-email">{firebaseUser?.email}</span>
        </span>
        <LogOut size={16} className="sidebar__logout-icon" aria-hidden="true" />
      </button>

      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-panel sidebar__logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar__logout-modal-icon"><LogOut size={26} /></div>
            <h3>¿Cerrar sesión?</h3>
            <p className="helper-text">Vas a salir de tu cuenta. Podés volver a ingresar cuando quieras.</p>
            <div className="sidebar__logout-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>Cancelar</button>
              <button type="button" className="sidebar__logout-modal-confirm" onClick={handleLogout}>Sí, salir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          flex-shrink: 0;
          background: var(--color-surface);
          border-right: 1px solid var(--color-line);
          display: flex;
          flex-direction: column;
          padding: 22px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .sidebar__brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 8px 22px;
        }
        .sidebar__brand-mark {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .sidebar__brand-name {
          margin: 0;
          font-weight: 700;
          font-size: 0.95rem;
          line-height: 1.2;
        }
        .sidebar__nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .sidebar__link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          color: var(--color-ink-soft);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.92rem;
        }
        .sidebar__link:hover { background: var(--color-bg); color: var(--color-ink); }
        .sidebar__link--active {
          background: var(--gradient-primary);
          color: #fff;
        }
        .sidebar__link--active:hover { background: var(--gradient-primary); color: #fff; }

        .sidebar__streak {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          margin-bottom: 10px;
          border-radius: var(--radius-sm);
          background: #FFF3E8;
          border: 1px solid #F5D9BC;
        }
        .sidebar__streak-icon {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #F97316;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar__streak-value { margin: 0; font-weight: 700; font-size: 0.85rem; color: #9A3412; }
        .sidebar__streak-label { margin: 0; font-size: 0.72rem; color: #B45309; }

        .sidebar__user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-line);
          background: transparent;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .sidebar__user:hover { background: #FBEAE8; border-color: #F3C6C0; }
        .sidebar__user:hover .sidebar__logout-icon { color: var(--color-danger); }
        .sidebar__user-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }
        .sidebar__user-name {
          font-size: 0.85rem;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sidebar__user-email {
          font-size: 0.74rem;
          color: var(--color-ink-soft);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sidebar__logout-icon { color: var(--color-ink-soft); flex-shrink: 0; transition: color 0.12s ease; }

        .sidebar__logout-modal { padding: 30px; text-align: center; }
        .sidebar__logout-modal-icon {
          width: 60px; height: 60px; border-radius: var(--radius-lg); background: #FBEAE8; color: var(--color-danger);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .sidebar__logout-modal h3 { margin: 0 0 8px; }
        .sidebar__logout-modal-actions { display: flex; gap: 10px; margin-top: 20px; }
        .sidebar__logout-modal-actions .btn { flex: 1; }
        .sidebar__logout-modal-confirm {
          flex: 1; background: var(--color-danger); color: #fff; border: none; border-radius: var(--radius-md);
          padding: 12px; font-weight: 700; cursor: pointer;
        }
        .sidebar__logout-modal-confirm:hover { background: #a8362a; }

        @media (max-width: 860px) {
          .sidebar { width: 76px; padding: 16px 10px; }
          .sidebar__brand-name, .sidebar__link span,
          .sidebar__user-info, .sidebar__streak-value, .sidebar__streak-label { display: none; }
          .sidebar__link { justify-content: center; }
          .sidebar__user { justify-content: center; }
          .sidebar__streak { justify-content: center; }
        }
      `}
      </style>
    </aside>
  );
}

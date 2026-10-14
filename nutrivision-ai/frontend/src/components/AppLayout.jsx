import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell__content">
        <MobileNav />
        <Outlet />
      </main>
    </div>
  );
}

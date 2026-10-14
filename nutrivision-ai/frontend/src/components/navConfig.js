import {
  Clock, CreditCard, Download, Home, LayoutDashboard, Stethoscope, Tag, User, UserRound, Users,
} from 'lucide-react';

/**
 * Navegación de cada rol. El paciente tiene el escáner (botón destacado / central)
 * y la racha; el nutricionista y el administrador tienen su propio menú.
 */
export function navFor(role) {
  if (role === 'NUTRITIONIST') {
    return {
      home: '/nutri',
      scan: false,
      streak: false,
      links: [
        { to: '/nutri/pacientes', label: 'Pacientes', icon: Users },
        { to: '/nutri/perfil', label: 'Mi perfil', icon: UserRound },
        { to: '/nutri/suscripcion', label: 'Suscripción', icon: CreditCard },
        { to: '/download', label: 'Descargar app', icon: Download },
      ],
      tabs: [
        { to: '/nutri/pacientes', label: 'Pacientes', icon: Users },
        { to: '/nutri/perfil', label: 'Mi perfil', icon: UserRound },
        { to: '/nutri/suscripcion', label: 'Suscripción', icon: CreditCard },
      ],
    };
  }
  if (role === 'ADMIN') {
    return {
      home: '/admin',
      scan: false,
      streak: false,
      links: [
        { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
        { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
        { to: '/admin/nutricionistas', label: 'Nutricionistas', icon: Stethoscope },
      ],
      tabs: [
        { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
        { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
        { to: '/admin/nutricionistas', label: 'Nutricionistas', icon: Stethoscope },
      ],
    };
  }
  return {
    home: '/dashboard',
    scan: true,
    streak: true,
    links: [
      { to: '/dashboard', label: 'Inicio', icon: Home },
      { to: '/history', label: 'Historial', icon: Clock },
      { to: '/profile', label: 'Perfil', icon: User },
      { to: '/pricing', label: 'Precios', icon: Tag },
      { to: '/download', label: 'Descargar app', icon: Download },
    ],
    tabs: [
      { to: '/dashboard', label: 'Inicio', icon: Home },
      { to: '/history', label: 'Historial', icon: Clock },
      { to: '/scan', label: 'Escanear', center: true },
      { to: '/pricing', label: 'Precios', icon: Tag },
      { to: '/profile', label: 'Perfil', icon: User },
    ],
  };
}

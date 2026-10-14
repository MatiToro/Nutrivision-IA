// Etiquetas y colores compartidos del panel de Administrador (igual que mobile).
export const ROLE_LABELS = { USER: 'Usuario', NUTRITIONIST: 'Nutricionista', ADMIN: 'Administrador' };
export const NUTRI_STATUS_LABELS = { PENDING: 'Pendiente', APPROVED: 'Aprobado', REJECTED: 'Rechazado' };
export const roleTone = (role) => ({ USER: 'blue', NUTRITIONIST: 'purple', ADMIN: 'gray' }[role] || 'gray');
export const statusTone = (status) => ({ PENDING: 'gold', APPROVED: 'green', REJECTED: 'red' }[status] || 'gray');

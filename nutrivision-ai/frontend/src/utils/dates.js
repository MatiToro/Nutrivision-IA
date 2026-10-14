// Utilidades de fechas (mismo criterio que la app mobile: día de calendario local).
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const pad = (n) => String(n).padStart(2, '0');

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Lunes de la semana de `date`. */
export function mondayOf(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}

/** "Lunes 28 de septiembre" */
export function longDate(date) {
  const s = `${DAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "L", "M", "X"… */
export const shortDay = (date) => DAYS_SHORT[date.getDay()];

/** "28 sep" */
export const dayMonth = (date) => `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;

/** "28 de sept. de 2026" */
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** "28 de septiembre de 2026" */
export const fmtLongDate = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

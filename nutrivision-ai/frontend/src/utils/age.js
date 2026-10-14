// Edad y fecha de nacimiento (misma lógica que la app mobile y el backend).
export const AGE_LIMITS = { min: 13, max: 100 };

/** Edad a partir de la fecha de nacimiento ("1998-05-10T00:00:00.000Z": se leen los componentes en UTC). */
export function ageFromBirthDate(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getUTCFullYear();
  const beforeBirthday = today.getMonth() < b.getUTCMonth()
    || (today.getMonth() === b.getUTCMonth() && today.getDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Edad a mostrar: calculada desde la fecha de nacimiento.. */
export const displayAge = (profile) => ageFromBirthDate(profile?.birthDate) ?? profile?.age ?? null;

/** Valida día/mes/año y devuelve { iso: 'AAAA-MM-DD', age } o { error }. */
export function parseBirthDate(day, month, year) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!day || !month || !year) return { error: 'Completá tu fecha de nacimiento.' };
  if (String(year).length !== 4 || !Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return { error: 'Revisá la fecha de nacimiento (día, mes y año de 4 cifras).' };
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { error: 'Esa fecha no existe. Revisá el día y el mes.' };
  }
  const age = ageFromBirthDate(date);
  if (age < AGE_LIMITS.min || age > AGE_LIMITS.max) {
    return { error: `Tenés que tener entre ${AGE_LIMITS.min} y ${AGE_LIMITS.max} años para usar NutriVision.` };
  }
  return { iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, age };
}

// Edad a partir de la fecha de nacimiento.
// birthDate se guarda como DATE (sin hora): se leen sus componentes en UTC
// para que la zona horaria del servidor no corra el día.
function ageFromBirthDate(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let age = today.getFullYear() - b.getUTCFullYear();
  const beforeBirthday = today.getMonth() < b.getUTCMonth()
    || (today.getMonth() === b.getUTCMonth() && today.getDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

module.exports = { ageFromBirthDate };

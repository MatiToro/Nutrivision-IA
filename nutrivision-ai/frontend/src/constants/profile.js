import {
  Activity, Apple, Armchair, Dumbbell, Equal, Footprints, TrendingDown, TrendingUp, Zap,
} from 'lucide-react';

// Mismas opciones (y los mismos íconos) que la app mobile.

export const SEX_OPTIONS = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
];

export const ACTIVITY_OPTIONS = [
  { value: 'SEDENTARY', label: 'Sedentario', desc: 'Pasa la mayor parte del tiempo sentado', Icon: Armchair },
  { value: 'LIGHT', label: 'Ligero', desc: 'Camina un poco o hace ejercicio ligero 1–2 veces por semana', Icon: Footprints },
  { value: 'MODERATE', label: 'Moderado', desc: 'Entrena de 3 a 5 veces por semana', Icon: Dumbbell },
  { value: 'ACTIVE', label: 'Activo', desc: 'Entrena de 6 a 7 veces por semana', Icon: Activity },
  { value: 'VERY_ACTIVE', label: 'Muy activo', desc: 'Entrena intensamente casi todos los días', Icon: Zap },
];

export const GOAL_OPTIONS = [
  { value: 'LOSE_WEIGHT', label: 'Perder peso', subtitle: 'Déficit calórico', Icon: TrendingDown },
  { value: 'MAINTAIN', label: 'Mantener el peso', subtitle: 'Equilibrio calórico', Icon: Equal },
  { value: 'GAIN_MUSCLE', label: 'Ganar masa muscular', subtitle: 'Superávit + proteína', Icon: Dumbbell },
  { value: 'GAIN_WEIGHT', label: 'Aumentar de peso', subtitle: 'Superávit calórico', Icon: TrendingUp },
  { value: 'MODIFY_DIET', label: 'Modificar mi dieta', subtitle: 'Cambiar hábitos', Icon: Apple },
];

export const findOption = (options, value) => options.find((o) => o.value === value) || null;

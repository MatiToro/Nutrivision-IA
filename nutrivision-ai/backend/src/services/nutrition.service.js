// Cálculo de metas diarias a partir de los datos biométricos del
// Formulario de Objetivos, usando la fórmula de Mifflin-St Jeor
// (estándar aceptado para estimar el gasto calórico basal).

const ACTIVITY_FACTORS = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

// % de ajuste sobre las calorías de mantenimiento, según el objetivo.
const GOAL_ADJUSTMENT = {
  LOSE_WEIGHT: -0.20,
  MAINTAIN: 0,
  GAIN_MUSCLE: 0.15,
  GAIN_WEIGHT: 0.20,   // superávit más general, no enfocado en masa magra
  MODIFY_DIET: 0,      // el objetivo acá es la composición de la dieta, no el peso
};

// Gramos de proteína por kg de peso corporal, según el objetivo.
const PROTEIN_PER_KG = {
  LOSE_WEIGHT: 1.8,   // proteína alta en déficit ayuda a preservar masa muscular
  MAINTAIN: 1.6,
  GAIN_MUSCLE: 2.0,
  GAIN_WEIGHT: 1.8,
  MODIFY_DIET: 1.6,
};

function calculateDailyGoals({ weightKg, heightCm, age, sex, activityLevel, goal }) {
  // Tasa Metabólica Basal (TMB)
  const bmi = sex === 'FEMALE'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

  const activityFactor = ACTIVITY_FACTORS[activityLevel] || ACTIVITY_FACTORS.MODERATE;
  const maintenanceCalories = bmi * activityFactor;

  const adjustment = GOAL_ADJUSTMENT[goal] ?? 0;
  const dailyCalorieGoal = Math.round(maintenanceCalories * (1 + adjustment));

  // Distribución de macros: proteína prioritaria (objetivo de composición
  // corporal), resto repartido entre carbohidratos y grasas.
  const proteinGPerKg = PROTEIN_PER_KG[goal] ?? 1.6;
  const dailyProteinGoalG = Math.round(weightKg * proteinGPerKg);
  const proteinCalories = dailyProteinGoalG * 4;

  const remainingCalories = Math.max(dailyCalorieGoal - proteinCalories, 0);
  const dailyFatGoalG = Math.round((remainingCalories * 0.3) / 9);
  const dailyCarbsGoalG = Math.round((remainingCalories * 0.7) / 4);

  return { dailyCalorieGoal, dailyProteinGoalG, dailyCarbsGoalG, dailyFatGoalG };
}

function sumIngredients(ingredients) {
  return ingredients.reduce((acc, ing) => ({
    totalCalories: acc.totalCalories + (Number(ing.calories) || 0),
    totalProteinG: acc.totalProteinG + (Number(ing.proteinG) || 0),
    totalCarbsG: acc.totalCarbsG + (Number(ing.carbsG) || 0),
    totalFatG: acc.totalFatG + (Number(ing.fatG) || 0),
  }), { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 });
}

module.exports = { calculateDailyGoals, sumIngredients };

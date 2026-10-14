import './NutritionLabelCard.css';

/**
 * Elemento de firma visual del producto: el desglose de macros se lee
 * como una etiqueta nutricional real
 */
export default function NutritionLabelCard({ totals, goal }) {
  const rows = [
    { label: 'Proteínas', value: totals.totalProteinG ?? totals.proteinG, unit: 'g', goal: goal?.proteinG },
    { label: 'Carbohidratos', value: totals.totalCarbsG ?? totals.carbsG, unit: 'g', goal: goal?.carbsG },
    { label: 'Grasas', value: totals.totalFatG ?? totals.fatG, unit: 'g', goal: goal?.fatG },
  ];

  const calories = Math.round(totals.totalCalories ?? totals.calories ?? 0);

  return (
    <div className="nutrition-label">
      <div className="nutrition-label__eyebrow">Desglose Nutricional</div>
      <div className="nutrition-label__rule nutrition-label__rule--thick" />
      <div className="nutrition-label__calories">
        <span className="nutrition-label__calories-label">Calorías</span>
        <span className="nutrition-label__calories-value mono-num">{calories}</span>
      </div>
      <div className="nutrition-label__rule nutrition-label__rule--thick" />
      {rows.map((row) => (
        <div className="nutrition-label__row" key={row.label}>
          <span>{row.label}</span>
          <span className="mono-num">
            {Math.round(row.value ?? 0)}
            {row.unit}
            {row.goal ? <span className="nutrition-label__goal"> / {row.goal}{row.unit}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
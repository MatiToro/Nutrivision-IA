export default function MacroBar({ label, value, goal, color, unit = 'g' }) {
  const pct = goal ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div className="macro-bar">
      <div className="macro-bar__top">
        <span className="macro-bar__dot" style={{ backgroundColor: color }} />
        <span className="macro-bar__label">{label}</span>
        <span className="macro-bar__value">
          {Math.round(value)}{unit}<span className="macro-bar__goal"> / {goal ? `${Math.round(goal)}${unit}` : '—'}</span>
        </span>
      </div>
      <div className="macro-bar__track">
        <div className="macro-bar__fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>

      <style>{`
        .macro-bar__top { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
        .macro-bar__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .macro-bar__label { flex: 1; font-size: 0.85rem; font-weight: 600; }
        .macro-bar__value { font-size: 0.85rem; font-weight: 800; }
        .macro-bar__goal { font-weight: 500; color: var(--color-ink-soft); }
        .macro-bar__track { height: 6px; background: var(--color-surface); border-radius: 3px; overflow: hidden; }
        .macro-bar__fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
      `}
      </style>
    </div>
  );
}

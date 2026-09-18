export default function MacroBar({ label, value, goal, color, unit = 'g' }) {
  const pct = goal ? Math.min((value / goal) * 100, 100) : 0;
  return (
    <div className="macro-bar">
      <div className="macro-bar__top">
        <span className="macro-bar__label">{label}</span>
        <span className="macro-bar__value mono-num">
          {Math.round(value)}<span className="macro-bar__goal"> /{Math.round(goal)}{unit}</span>
        </span>
      </div>
      <div className="macro-bar__track">
        <div className="macro-bar__fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>

      <style>{`
        .macro-bar__top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
        .macro-bar__label { font-size: 0.85rem; color: var(--color-ink-soft); }
        .macro-bar__value { font-size: 0.85rem; font-weight: 700; }
        .macro-bar__goal { font-weight: 500; color: var(--color-ink-soft); }
        .macro-bar__track { height: 8px; background: var(--color-bg); border-radius: 999px; overflow: hidden; }
        .macro-bar__fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
      `}
      </style>
    </div>
  );
}

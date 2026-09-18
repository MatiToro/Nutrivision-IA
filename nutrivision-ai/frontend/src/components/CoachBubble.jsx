const ALIGNMENT_COPY = {
  ON_TRACK: { label: 'En línea con tu objetivo', tone: 'ok' },
  NEEDS_ADJUSTMENT: { label: 'Conviene ajustar el resto del día', tone: 'warn' },
  OFF_TRACK: { label: 'Lejos de tu objetivo de hoy', tone: 'alert' },
};

export default function CoachBubble({ feedback, mocked }) {
  if (!feedback) return null;
  const alignment = ALIGNMENT_COPY[feedback.alignment] || ALIGNMENT_COPY.ON_TRACK;

  return (
    <div className={`coach-bubble coach-bubble--${alignment.tone}`}>
      <div className="coach-bubble__header">
        <span className="coach-bubble__avatar" aria-hidden="true">🥑</span>
        <div>
          <p className="coach-bubble__title">Coach IA</p>
          <p className="coach-bubble__alignment">{alignment.label}</p>
        </div>
        {mocked && <span className="coach-bubble__badge">Demo</span>}
      </div>
      <p className="coach-bubble__summary">{feedback.summary}</p>
      {feedback.tips?.length > 0 && (
        <ul className="coach-bubble__tips">
          {feedback.tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      )}

      <style>{`
        .coach-bubble {
          background: var(--color-berry-soft);
          border: 1px solid var(--color-berry);
          border-radius: var(--radius-lg);
          padding: 18px 20px;
        }
        .coach-bubble__header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .coach-bubble__avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--color-surface);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
        }
        .coach-bubble__title {
          margin: 0;
          font-weight: 700;
          font-size: 0.92rem;
          color: var(--color-berry);
        }
        .coach-bubble__alignment {
          margin: 0;
          font-size: 0.82rem;
          color: var(--color-ink-soft);
        }
        .coach-bubble__badge {
          margin-left: auto;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          background: var(--color-ink);
          color: var(--color-surface);
          padding: 3px 8px;
          border-radius: 999px;
        }
        .coach-bubble__summary {
          margin: 0 0 8px 0;
          font-size: 0.96rem;
        }
        .coach-bubble__tips {
          margin: 0;
          padding-left: 18px;
          font-size: 0.9rem;
          color: var(--color-ink-soft);
        }
        .coach-bubble__tips li { margin-bottom: 4px; }
      `}
      </style>
    </div>
  );
}
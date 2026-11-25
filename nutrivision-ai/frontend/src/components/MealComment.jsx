import { useState } from 'react';
import { CheckCheck, MessageSquare, Trash2 } from 'lucide-react';
import apiClient from '../api/client';
import { useConfirm } from './roles';
import { Message } from './ui';

/** Lo que ve el PACIENTE en el detalle de su comida. */
export function NutritionistCommentCard({ comment }) {
  if (!comment) return null;
  return (
    <section className="card meal-comment">
      <div className="meal-comment__head">
        <span className="meal-comment__icon"><MessageSquare size={17} /></span>
        <div>
          <strong>Comentario de tu nutricionista</strong>
          <span>{comment.author}</span>
        </div>
      </div>
      <p className="meal-comment__text">{comment.text}</p>
      <MealCommentStyles />
    </section>
  );
}

/**
 * Lo que ve el NUTRICIONISTA al abrir una comida de su paciente: escribir,
 * cambiar o borrar su comentario (uno por comida). El paciente lo ve en el
 * detalle de la comida y le aparece un aviso en su Inicio.
 */
export function NutriCommentEditor({ patientId, mealId, initial }) {
  const [comment, setComment] = useState(initial || null);
  const [text, setText] = useState(initial?.text || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [ask, confirmModal] = useConfirm();
  const base = `/nutritionist/patients/${patientId}/meals/${mealId}/comment`;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { data } = await apiClient.put(base, { text: text.trim() });
      setComment(data.comment);
      setDone('Comentario guardado. Le va a aparecer un aviso al paciente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const remove = () => ask({
    title: 'Borrar comentario',
    message: 'El paciente deja de verlo.',
    confirmLabel: 'Borrar',
    danger: true,
    icon: <Trash2 size={20} />,
    onConfirm: async () => {
      setError(null);
      setDone(null);
      try {
        await apiClient.delete(base);
        setComment(null);
        setText('');
      } catch (err) {
        setError(err.message);
      }
    },
  });

  const unchanged = comment && text.trim() === comment.text;
  return (
    <form className="card meal-comment-editor" onSubmit={save}>
      <div className="section-header">
        <h3><MessageSquare size={17} color="var(--color-primary)" /> {comment ? 'Tu comentario' : 'Dejale un comentario'}</h3>
      </div>
      <p className="hint">El paciente lo ve en el detalle de esta comida y le llega un aviso en su Inicio.</p>
      {comment?.seenAt ? (
        <p className="meal-comment-editor__seen"><CheckCheck size={14} /> Visto el {new Date(comment.seenAt).toLocaleDateString('es-AR')}</p>
      ) : null}
      <textarea
        className="role-textarea"
        rows={3}
        maxLength={500}
        placeholder="Ej: ¡Muy bien la porción de verduras! Sumale una proteína."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error ? <Message>{error}</Message> : null}
      {done ? <Message tone="success">{done}</Message> : null}
      <div className="meal-comment-editor__actions">
        {comment ? <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}>Borrar</button> : null}
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim() || unchanged}>
          {busy ? 'Guardando…' : comment ? 'Guardar cambios' : 'Enviar comentario'}
        </button>
      </div>
      {confirmModal}
      <MealCommentStyles />
    </form>
  );
}

function MealCommentStyles() {
  return (
    <style>{`
      .meal-comment { background: var(--color-primary-soft); display: flex; flex-direction: column; gap: 10px; }
      .meal-comment__head { display: flex; align-items: center; gap: 10px; }
      .meal-comment__head strong { display: block; color: var(--color-primary-dark); }
      .meal-comment__head span { font-size: 0.8rem; color: var(--color-ink-soft); }
      .meal-comment__icon {
        width: 34px; height: 34px; border-radius: 50%; background: var(--color-primary); color: #fff;
        display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .meal-comment__text { margin: 0; line-height: 1.5; white-space: pre-wrap; }
      .meal-comment-editor { display: flex; flex-direction: column; gap: 10px; }
      .meal-comment-editor h3 { display: inline-flex; align-items: center; gap: 8px; margin: 0; }
      .meal-comment-editor .hint { margin: 0; }
      .meal-comment-editor__seen { display: inline-flex; align-items: center; gap: 5px; margin: 0; font-size: 0.8rem; font-weight: 700; color: var(--color-primary-dark); }
      .meal-comment-editor__actions { display: flex; gap: 8px; justify-content: flex-end; }
    `}</style>
  );
}

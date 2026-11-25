import { useState } from 'react';
import { Lock, Pencil, StickyNote, Trash2 } from 'lucide-react';
import apiClient from '../api/client';
import { useConfirm } from './roles';
import { Message, SectionHeader } from './ui';

const fmtDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Notas privadas del nutricionista sobre un paciente (ficha del paciente).
 * Solo las ve el nutricionista: el paciente nunca recibe estos datos.
 */
export default function PatientNotes({ patientId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes || []);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ask, confirmModal] = useConfirm();
  const base = `/nutritionist/patients/${patientId}/notes`;

  async function add(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.post(base, { text });
      setNotes((list) => [data.note, ...list]);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id) {
    const text = editText.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.patch(`${base}/${id}`, { text });
      setNotes((list) => list.map((n) => (n.id === id ? data.note : n)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const remove = (id) => ask({
    title: 'Borrar nota',
    message: 'La nota se borra para siempre.',
    confirmLabel: 'Borrar',
    danger: true,
    icon: <Trash2 size={20} />,
    onConfirm: async () => {
      setError(null);
      try {
        await apiClient.delete(`${base}/${id}`);
        setNotes((list) => list.filter((n) => n.id !== id));
      } catch (err) {
        setError(err.message);
      }
    },
  });

  return (
    <section className="card patient-notes">
      <SectionHeader title="Notas privadas" icon={<StickyNote size={17} color="var(--color-primary)" />} />
      <p className="hint patient-notes__privacy"><Lock size={12} /> Solo las ves vos: el paciente no tiene acceso.</p>

      <form onSubmit={add} className="patient-notes__form">
        <textarea
          className="role-textarea"
          rows={3}
          maxLength={2000}
          placeholder="Ej: Consulta 12/11: le cuesta desayunar, probar avena."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          {busy && !editingId ? 'Guardando…' : 'Agregar nota'}
        </button>
      </form>
      {error ? <Message>{error}</Message> : null}

      {notes.length === 0 ? <p className="hint">Todavía no escribiste notas sobre este paciente.</p> : null}
      {notes.map((n) => (
        <div key={n.id} className="patient-notes__item">
          {editingId === n.id ? (
            <>
              <textarea className="role-textarea" rows={3} maxLength={2000} value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
              <div className="patient-notes__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={() => saveEdit(n.id)} disabled={busy || !editText.trim()}>
                  {busy ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="patient-notes__text">{n.text}</p>
              <div className="patient-notes__foot">
                <span>{fmtDate(n.createdAt)}{new Date(n.updatedAt) - new Date(n.createdAt) > 60000 ? ' · editada' : ''}</span>
                <button type="button" className="icon-btn" onClick={() => { setEditingId(n.id); setEditText(n.text); }} aria-label="Editar nota">
                  <Pencil size={15} />
                </button>
                <button type="button" className="icon-btn" onClick={() => remove(n.id)} aria-label="Borrar nota">
                  <Trash2 size={15} color="var(--color-danger)" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      {confirmModal}

      <style>{`
        .patient-notes { display: flex; flex-direction: column; gap: 10px; }
        .patient-notes__privacy { display: inline-flex; align-items: center; gap: 5px; margin: 0; }
        .patient-notes__form { display: flex; flex-direction: column; gap: 8px; }
        .patient-notes__form .btn { align-self: flex-start; }
        .patient-notes__item { border-top: 1px solid var(--color-line); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
        .patient-notes__text { margin: 0; white-space: pre-wrap; line-height: 1.5; }
        .patient-notes__foot { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: var(--color-ink-muted); }
        .patient-notes__foot span { flex: 1; }
        .patient-notes__actions { display: flex; gap: 8px; justify-content: flex-end; }
      `}</style>
    </section>
  );
}

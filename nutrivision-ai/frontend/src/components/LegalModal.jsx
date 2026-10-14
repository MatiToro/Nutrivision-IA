import { useEffect } from 'react';
import { X } from 'lucide-react';
import Portal from './Portal';
import { LEGAL_DOCS, LEGAL_UPDATED } from '../constants/legal';

/**
 * Ventana con el texto de los Términos y Condiciones o de la Política de Privacidad.
 * `doc`: 'terms' | 'privacy' | null (cerrada).
 */
export default function LegalModal({ doc, onClose }) {
  const content = doc ? LEGAL_DOCS[doc] : null;

  // Cerrar con Escape
  useEffect(() => {
    if (!content) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [content, onClose]);

  if (!content) return null;

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel legal-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="legal-modal__header">
            <div>
              <h3 id="legal-modal-title">{content.title}</h3>
              <span className="legal-modal__updated">Última actualización: {LEGAL_UPDATED}</span>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          <div className="legal-modal__body">
            {content.sections.map((s) => (
              <section key={s.title}>
                <h4>{s.title}</h4>
                {s.body.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
              </section>
            ))}
          </div>

          <div className="legal-modal__footer">
            <button type="button" className="btn btn-primary" onClick={onClose}>Entendido</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

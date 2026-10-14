import { createPortal } from 'react-dom';

/**
 * Renderiza los modales directamente en <body>, fuera de la barra lateral y de las
 * tarjetas, para que siempre queden por encima de todo el contenido de la pantalla.
 */
export default function Portal({ children }) {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
}

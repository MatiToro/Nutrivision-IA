import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Search, X } from 'lucide-react';
import apiClient from '../../api/client';
import { Avatar, FilterChips, RatingLine, Tag } from '../../components/roles';
import { EmptyState, Message, PageTitle } from '../../components/ui';

const TABS = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'REJECTED', label: 'Rechazados' },
];
const EMPTY = {
  PENDING: ['No hay solicitudes pendientes', 'Cuando un nutricionista envíe su matrícula, va a aparecer acá.'],
  APPROVED: ['Todavía no hay nutricionistas aprobados', 'Aprobá una solicitud pendiente para que aparezca acá.'],
  REJECTED: ['No hay solicitudes rechazadas', ''],
};
const shortDate = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

/** Nutricionistas: solicitudes pendientes para aprobar o rechazar, aprobados y rechazados. */
export default function AdminNutritionistsPage() {
  const [status, setStatus] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ status });
        if (query.trim()) params.set('q', query.trim());
        const { data } = await apiClient.get(`/admin/nutritionists?${params.toString()}`);
        setList({ status, items: data.nutritionists });
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [status, query]);

  const items = list?.status === status ? list.items : null;

  return (
    <div className="page">
      <PageTitle title="Nutricionistas" subtitle="Verificá matrículas y gestioná profesionales." />
      <FilterChips options={TABS} value={status} onChange={setStatus} />
      <div className="role-search">
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, correo o matrícula" maxLength={80} aria-label="Buscar nutricionistas" />
        {query ? <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Borrar búsqueda" style={{ boxShadow: 'none', width: 28, height: 28 }}><X size={15} /></button> : null}
      </div>

      {error ? <Message>{error}</Message> : null}

      {items === null ? (
        <p className="hint">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="card"><EmptyState icon={<ClipboardCheck size={24} />} title={EMPTY[status][0]} text={EMPTY[status][1]} /></div>
      ) : (
        <div className="role-list">
          {items.map((n) => (
            <Link key={n.id} to={`/admin/nutricionistas/${n.id}`} className="role-list-item">
              <Avatar src={n.photoUrl} name={n.name} size={46} />
              <span className="role-list-item__body">
                <span className="role-list-item__name">{n.name}</span>
                <span className="role-list-item__meta">Matrícula {n.licenseNumber} · {n.email}</span>
                {status === 'PENDING' ? (
                  <span className="role-list-item__meta">Enviada el {shortDate(n.updatedAt)}</span>
                ) : status === 'APPROVED' ? (
                  <>
                    <RatingLine rating={n.rating} />
                    <span className="role-tags">
                      <Tag label={n.subscriptionActive ? 'Suscripción activa' : 'Sin suscripción'} tone={n.subscriptionActive ? 'green' : 'gray'} />
                      <Tag label={`${n.activePatients} ${n.activePatients === 1 ? 'paciente' : 'pacientes'}`} tone="blue" />
                      {n.banned ? <Tag label="Baneado" tone="red" /> : null}
                    </span>
                  </>
                ) : (
                  <span className="role-list-item__meta" style={{ color: 'var(--color-danger)' }}>Motivo: {n.rejectionReason}</span>
                )}
              </span>
              <ChevronRight size={18} className="menu-row__chevron" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

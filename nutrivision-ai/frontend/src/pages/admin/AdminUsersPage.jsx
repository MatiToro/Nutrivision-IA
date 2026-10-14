import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, Users, X } from 'lucide-react';
import apiClient from '../../api/client';
import { Avatar, FilterChips, Tag } from '../../components/roles';
import { EmptyState, Message, PageTitle } from '../../components/ui';
import { NUTRI_STATUS_LABELS, ROLE_LABELS, roleTone, statusTone } from './adminLabels';

const FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'USER', label: 'Usuarios' },
  { value: 'NUTRITIONIST', label: 'Nutricionistas' },
  { value: 'PREMIUM', label: 'Pro' },
  { value: 'BANNED', label: 'Baneados' },
  { value: 'ADMIN', label: 'Admins' },
];

/** Gestión de usuarios: búsqueda, filtros y acceso al detalle. */
export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [result, setResult] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(async (q, f, page) => {
    const params = new URLSearchParams({ filter: f, page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    const { data } = await apiClient.get(`/admin/users?${params.toString()}`);
    return data;
  }, []);

  // Búsqueda con una pequeña espera para no pedir en cada letra.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setResult(await fetchPage(query, filter, 1));
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, filter, fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await fetchPage(query, filter, result.page + 1);
      setResult((prev) => ({ ...next, users: [...prev.users, ...next.users] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="page">
      <PageTitle title="Usuarios" subtitle={result ? `${result.total} ${result.total === 1 ? 'cuenta' : 'cuentas'}` : 'Todas las cuentas registradas'} />

      <div className="role-search">
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o correo" maxLength={80} aria-label="Buscar usuarios" />
        {query ? <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Borrar búsqueda" style={{ boxShadow: 'none', width: 28, height: 28 }}><X size={15} /></button> : null}
      </div>
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {error ? <Message>{error}</Message> : null}

      {result === null ? (
        <p className="hint">Cargando…</p>
      ) : result.users.length === 0 ? (
        <div className="card"><EmptyState icon={<Users size={24} />} title="Sin resultados" text="Probá con otra búsqueda o filtro." /></div>
      ) : (
        <div className="role-list">
          {result.users.map((u) => (
            <Link key={u.id} to={`/admin/usuarios/${u.id}`} className={`role-list-item${u.banned ? ' is-banned' : ''}`}>
              <Avatar src={u.photoUrl} name={u.name} size={44} />
              <span className="role-list-item__body">
                <span className="role-list-item__name">{u.name}</span>
                <span className="role-list-item__meta">{u.email}</span>
                <span className="role-tags">
                  <Tag label={ROLE_LABELS[u.role]} tone={roleTone(u.role)} />
                  {u.role === 'USER' ? <Tag label={u.isPremium ? (u.plan === 'PREMIUM' ? 'Pro' : 'Pro (código)') : 'Gratuito'} tone={u.isPremium ? 'gold' : 'gray'} /> : null}
                  {u.role === 'NUTRITIONIST' ? <Tag label={u.nutritionistStatus ? NUTRI_STATUS_LABELS[u.nutritionistStatus] : 'Sin solicitud'} tone={statusTone(u.nutritionistStatus)} /> : null}
                  {u.banned ? <Tag label="Baneado" tone="red" /> : null}
                </span>
              </span>
              <ChevronRight size={18} className="menu-row__chevron" />
            </Link>
          ))}
          {result.hasMore ? (
            <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Cargando…' : 'Cargar más'}</button>
          ) : null}
        </div>
      )}
    </div>
  );
}

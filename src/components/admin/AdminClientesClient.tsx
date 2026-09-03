'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, TrendingUp, ShoppingBag, Search,
  ArrowUpDown, Mail, Phone, ExternalLink, UserX, Wallet, X,
} from 'lucide-react';
import { formatPrice, formatDate } from '@/utils';
import { cn } from '@/utils';
import toast from 'react-hot-toast';

interface ClienteMayorista {
  id: string;
  profile_id: string;
  monto_minimo_pedido: number | null;
  descuento_fijo_pct: number;
  limite_cuenta_corriente: number;
  saldo_cuenta_corriente: number;
  notas: string | null;
  activo: boolean;
}

interface Client {
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  ciudad: string | null;
  created_at: string;
  totalPedidos: number;
  totalGastado: number;
  ultimoPedido: string | null;
}

interface Metrics {
  totalClientes:   number;
  clientesActivos: number;
  totalGastado:    number;
  ticketPromedio:  number;
  pedidosInvitados: number;
}

type SortKey = 'nombre' | 'totalGastado' | 'totalPedidos' | 'ultimoPedido' | 'created_at';

interface Props { clients: Client[]; metrics: Metrics }

export function AdminClientesClient({ clients, metrics }: Props) {
  const [search,    setSearch]    = useState('');
  const [sortBy,    setSortBy]    = useState<SortKey>('totalGastado');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [soloActivos, setSoloActivos] = useState(false);

  // ── Condiciones mayoristas (pedido mínimo particular / descuento / cuenta corriente) ──
  const [condiciones, setCondiciones] = useState<Map<string, ClienteMayorista>>(new Map());
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ monto_minimo_pedido: '', descuento_fijo_pct: '0', limite_cuenta_corriente: '0', notas: '', activo: true });
  const [saving, setSaving] = useState(false);
  const [pagoRegistrado, setPagoRegistrado] = useState('');

  useEffect(() => {
    fetch('/api/admin/clientes-mayoristas')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setCondiciones(new Map(data.map((c: ClienteMayorista) => [c.profile_id, c])));
      })
      .catch(() => {});
  }, []);

  const openEdit = (client: Client) => {
    const existing = condiciones.get(client.id);
    setForm({
      monto_minimo_pedido: existing?.monto_minimo_pedido != null ? String(existing.monto_minimo_pedido) : '',
      descuento_fijo_pct: String(existing?.descuento_fijo_pct ?? 0),
      limite_cuenta_corriente: String(existing?.limite_cuenta_corriente ?? 0),
      notas: existing?.notas ?? '',
      activo: existing?.activo ?? true,
    });
    setEditing(client);
    setPagoRegistrado('');
    setVerMovimientos(false);
    setMovimientos([]);
  };

  const handleRegistrarPago = async () => {
    if (!editing) return;
    const existing = condiciones.get(editing.id);
    if (!existing) return;
    const monto = Number(pagoRegistrado);
    if (!monto || monto <= 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/clientes-mayoristas/registrar-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: editing.id, monto }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setCondiciones((prev) => new Map(prev).set(editing.id, data.data));
      setPagoRegistrado('');
      toast.success(`Pago de ${formatPrice(monto)} registrado — nuevo saldo: ${formatPrice(data.nuevoSaldo)}`);
      if (verMovimientos) cargarMovimientos(editing.id);
    } catch {
      toast.error('Error al registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  // ── Estado de cuenta: historial de cargos/pagos del cliente en edición ──
  const [verMovimientos, setVerMovimientos] = useState(false);
  const [movimientos, setMovimientos] = useState<{
    id: string; tipo: 'cargo' | 'pago' | 'ajuste'; monto: number;
    saldo_resultante: number; concepto: string | null; created_at: string;
  }[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);

  const cargarMovimientos = async (profileId: string) => {
    setCargandoMovimientos(true);
    try {
      const res = await fetch(`/api/admin/clientes-mayoristas/movimientos?profile_id=${profileId}`);
      const json = await res.json();
      setMovimientos(res.ok ? json.data ?? [] : []);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  const toggleMovimientos = () => {
    if (!editing) return;
    const next = !verMovimientos;
    setVerMovimientos(next);
    if (next) cargarMovimientos(editing.id);
  };

  const handleSaveCondicion = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const existing = condiciones.get(editing.id);
      const payload = {
        profile_id: editing.id,
        monto_minimo_pedido: form.monto_minimo_pedido === '' ? null : Number(form.monto_minimo_pedido),
        descuento_fijo_pct: Number(form.descuento_fijo_pct),
        limite_cuenta_corriente: Number(form.limite_cuenta_corriente),
        notas: form.notas || null,
        activo: form.activo,
      };
      const res = existing
        ? await fetch('/api/admin/clientes-mayoristas', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: existing.id, ...payload }),
          })
        : await fetch('/api/admin/clientes-mayoristas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setCondiciones((prev) => new Map(prev).set(editing.id, data.data));
      toast.success('Condiciones guardadas');
      setEditing(null);
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCondicion = async () => {
    if (!editing) return;
    const existing = condiciones.get(editing.id);
    if (!existing) { setEditing(null); return; }
    if (!confirm('¿Quitar las condiciones particulares de este cliente? Va a volver a las condiciones generales del sitio.')) return;
    const res = await fetch(`/api/admin/clientes-mayoristas/${existing.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setCondiciones((prev) => { const m = new Map(prev); m.delete(editing.id); return m; });
    toast.success('Condiciones eliminadas');
    setEditing(null);
  };

  const filtered = useMemo(() => {
    let list = [...clients];

    if (soloActivos) list = list.filter((c) => c.totalPedidos > 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.nombre?.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.telefono?.includes(q) ||
        c.ciudad?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let va: string | number = a[sortBy] ?? '';
      let vb: string | number = b[sortBy] ?? '';
      if (typeof va === 'string' && typeof vb === 'string') {
        va = va.toLowerCase(); vb = vb.toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    return list;
  }, [clients, search, sortBy, sortDir, soloActivos]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wide',
        sortBy === k ? 'text-brand-600' : 'text-muted hover:text-foreground'
      )}
    >
      {label}
      <ArrowUpDown size={11} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Users size={22} /> Clientes
        </h1>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { icon: Users,       label: 'Clientes registrados', value: metrics.totalClientes,    fmt: 'num'   },
          { icon: ShoppingBag, label: 'Con compras',           value: metrics.clientesActivos,  fmt: 'num'   },
          { icon: TrendingUp,  label: 'Ingresos generados',   value: metrics.totalGastado,     fmt: 'price' },
          { icon: TrendingUp,  label: 'Ticket promedio',       value: metrics.ticketPromedio,   fmt: 'price' },
          { icon: UserX,       label: 'Pedidos de invitados',  value: metrics.pedidosInvitados, fmt: 'num'   },
        ].map(({ icon: Icon, label, value, fmt }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-brand-500" />
              <p className="text-xs text-muted">{label}</p>
            </div>
            <p className="text-xl font-bold">
              {fmt === 'price' ? formatPrice(value) : value.toLocaleString('es-AR')}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono…"
            className="input-base pl-9 text-sm w-full" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="rounded border-border" />
          Solo con compras
        </label>
        <p className="text-sm text-muted ml-auto">
          {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}
        </p>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2">
              <tr>
                <th className="p-3 text-left"><SortBtn k="nombre" label="Cliente" /></th>
                <th className="p-3 text-left hidden md:table-cell">Contacto</th>
                <th className="p-3 text-left hidden lg:table-cell"><SortBtn k="created_at" label="Registro" /></th>
                <th className="p-3 text-right"><SortBtn k="totalPedidos" label="Pedidos" /></th>
                <th className="p-3 text-right"><SortBtn k="totalGastado" label="Total gastado" /></th>
                <th className="p-3 text-right hidden md:table-cell"><SortBtn k="ultimoPedido" label="Último pedido" /></th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted">
                    No hay clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : filtered.map((client) => (
                <tr key={client.id}
                  className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{client.nombre ?? '—'}</p>
                      <p className="text-xs text-muted">{client.email}</p>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {client.telefono && (
                        <p className="text-xs flex items-center gap-1 text-muted">
                          <Phone size={10} /> {client.telefono}
                        </p>
                      )}
                      {client.ciudad && (
                        <p className="text-xs text-muted">{client.ciudad}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted hidden lg:table-cell">
                    {formatDate(client.created_at)}
                  </td>
                  <td className="p-3 text-right">
                    {client.totalPedidos > 0 ? (
                      <span className="font-semibold">{client.totalPedidos}</span>
                    ) : (
                      <span className="text-xs text-muted">Sin pedidos</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {client.totalGastado > 0 ? (
                      <span className="font-semibold text-brand-600">
                        {formatPrice(client.totalGastado)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-xs text-muted hidden md:table-cell">
                    {client.ultimoPedido ? formatDate(client.ultimoPedido) : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(client)}
                        className={cn(
                          'btn-ghost p-1.5',
                          condiciones.has(client.id) ? 'text-purple-600' : 'text-muted hover:text-brand-600'
                        )}
                        title={condiciones.has(client.id) ? 'Ver/editar condiciones mayoristas' : 'Cargar condiciones mayoristas'}
                      >
                        <Wallet size={14} />
                      </button>
                      <a href={`mailto:${client.email}`}
                        className="btn-ghost p-1.5 text-muted hover:text-brand-600"
                        title={`Enviar email a ${client.email}`}>
                        <Mail size={14} />
                      </a>
                      <Link
                        href={`/admin/pedidos?email=${encodeURIComponent(client.email)}`}
                        className="btn-ghost p-1.5 text-muted hover:text-brand-600"
                        title="Ver pedidos de este cliente">
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota sobre invitados */}
      {metrics.pedidosInvitados > 0 && (
        <div className="card p-4 flex items-start gap-3 bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800">
          <UserX size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Hay <strong>{metrics.pedidosInvitados}</strong> pedido{metrics.pedidosInvitados !== 1 ? 's' : ''} realizados por invitados (sin cuenta).
            Estos no aparecen en esta tabla pero sí en el listado de pedidos.
          </p>
        </div>
      )}

      {/* ── Modal de condiciones mayoristas ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><Wallet size={16} /> Condiciones mayoristas</h2>
                <p className="text-xs text-muted">{editing.nombre ?? editing.email}</p>
              </div>
              <button onClick={() => setEditing(null)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            {condiciones.get(editing.id) && (condiciones.get(editing.id)?.saldo_cuenta_corriente ?? 0) > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 space-y-2">
                <p>Saldo actual (deuda) en cuenta corriente: <strong>{formatPrice(condiciones.get(editing.id)!.saldo_cuenta_corriente)}</strong></p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" step="0.01"
                    value={pagoRegistrado}
                    onChange={(e) => setPagoRegistrado(e.target.value)}
                    placeholder="Monto pagado"
                    className="input-base flex-1 py-1.5 text-xs bg-white dark:bg-surface"
                  />
                  <button
                    onClick={handleRegistrarPago}
                    disabled={saving || !pagoRegistrado || Number(pagoRegistrado) <= 0}
                    className="btn-ghost text-xs border border-amber-300 dark:border-amber-700 px-2 py-1.5 whitespace-nowrap disabled:opacity-50"
                  >
                    Registrar pago
                  </button>
                </div>
                <p className="text-[10px] opacity-80">Resta el monto pagado del saldo — usalo cuando el cliente te paga la deuda acumulada.</p>
              </div>
            )}

            {/* ✅ Estado de cuenta: historial de cargos/pagos, para auditar de
                 dónde sale el saldo actual (o simplemente ver movimientos
                 pasados de un cliente que ya está al día). */}
            {!!condiciones.get(editing.id)?.limite_cuenta_corriente && (
              <div>
                <button onClick={toggleMovimientos} className="text-xs text-brand-600 underline hover:no-underline">
                  {verMovimientos ? 'Ocultar' : 'Ver'} estado de cuenta
                </button>
                {verMovimientos && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {cargandoMovimientos ? (
                      <p className="text-xs text-muted p-3">Cargando…</p>
                    ) : movimientos.length === 0 ? (
                      <p className="text-xs text-muted p-3">Todavía no hay movimientos registrados.</p>
                    ) : (
                      movimientos.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-3 py-2 text-xs">
                          <div>
                            <p className={m.tipo === 'pago' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {m.tipo === 'pago' ? '− ' : '+ '}{formatPrice(m.monto)}
                              <span className="text-muted font-normal"> · {m.concepto ?? (m.tipo === 'pago' ? 'Pago' : 'Cargo')}</span>
                            </p>
                            <p className="text-muted text-[10px]">{formatDate(m.created_at)}</p>
                          </div>
                          <p className="text-muted text-[10px]">Saldo: {formatPrice(m.saldo_resultante)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1">Pedido mínimo particular</label>
              <input type="number" min="0" step="0.01" value={form.monto_minimo_pedido}
                onChange={(e) => setForm((p) => ({ ...p, monto_minimo_pedido: e.target.value }))}
                placeholder="Vacío = usa el mínimo general del sitio"
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Descuento fijo (%)</label>
              <input type="number" min="0" max="100" step="0.1" value={form.descuento_fijo_pct}
                onChange={(e) => setForm((p) => ({ ...p, descuento_fijo_pct: e.target.value }))}
                className="input-base" />
              <p className="text-[10px] text-muted mt-1">Se aplica automáticamente sobre el subtotal en cada compra de este cliente.</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Límite de cuenta corriente</label>
              <input type="number" min="0" step="0.01" value={form.limite_cuenta_corriente}
                onChange={(e) => setForm((p) => ({ ...p, limite_cuenta_corriente: e.target.value }))}
                placeholder="0 = sin cuenta corriente"
                className="input-base" />
              <p className="text-[10px] text-muted mt-1">0 = el cliente no ve la opción de pagar a cuenta corriente en el checkout.</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notas internas</label>
              <textarea value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                rows={2} className="input-base resize-none" placeholder="Ej: cliente desde 2023, paga puntual…" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.activo}
                onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))}
                className="rounded border-border" />
              Condiciones activas
            </label>

            <div className="flex gap-2 pt-2">
              {condiciones.has(editing.id) && (
                <button onClick={handleDeleteCondicion} className="btn-ghost text-red-500 text-sm">Quitar condiciones</button>
              )}
              <button onClick={handleSaveCondicion} disabled={saving} className="btn-primary flex-1 text-sm">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

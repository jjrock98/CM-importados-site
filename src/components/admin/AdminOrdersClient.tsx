'use client';
import React from 'react';
import { useState, useCallback } from 'react';
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/utils';
import { PACK_CONFIG } from '@/types';
import type { Order, OrderEstado } from '@/types';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import {
  ExternalLink, ChevronDown, Search, CheckCircle, XCircle,
  FileCheck, Clock, Loader2, AlertTriangle, MessageCircle,
} from 'lucide-react';
import { buildOrderWhatsAppLink } from '@/lib/whatsapp';
import { cn } from '@/utils';
import toast from 'react-hot-toast';

const ESTADOS: OrderEstado[] = ['pendiente','pendiente_pago','pagado','procesando','enviado','entregado','cancelado','rechazado'];

interface Props { initialOrders: Order[] }

export function AdminOrdersClient({ initialOrders }: Props) {
  const [orders,   setOrders]   = useState<Order[]>(initialOrders);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<string>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading,  setLoading]  = useState<string | null>(null);

  // ── Reject modal state ──────────────────────────────────────
  const [rejectModal, setRejectModal] = useState<{ orderId: string } | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [filtroTipoVenta, setFiltroTipoVenta] = useState<'todos' | 'mayorista' | 'minorista'>('todos');
  const [exportDesde, setExportDesde] = useState('');
  const [exportHasta, setExportHasta] = useState('');
  const [exporting,   setExporting]   = useState(false);

  // ── Realtime: update orders list when DB changes ────────────
  const handleOrdersChange = useCallback((updated: Order[]) => {
    setOrders(updated);
    toast('Pedidos actualizados en tiempo real', { icon: '🔄', duration: 2000 });
  }, []);

  useRealtimeOrders(handleOrdersChange);

  const filtered = orders.filter((o) => {
    if (filtroTipoVenta !== 'todos' && (o as Order & {tipo_venta?: string}).tipo_venta !== filtroTipoVenta) return false;
    const matchFilter = filter === 'todos' || o.estado === filter;
    const matchSearch = !search ||
      o.nombre.toLowerCase().includes(search.toLowerCase()) ||
      o.email.toLowerCase().includes(search.toLowerCase()) ||
      o.id.slice(0,8).toUpperCase().includes(search.toUpperCase());
    return matchFilter && matchSearch;
  });

  // Counts for filter tabs
  const pendingComprobanteCount = orders.filter(
    (o) => o.metodo_pago === 'transferencia' && o.comprobante_url && !o.comprobante_revisado
  ).length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportDesde) params.set('desde', exportDesde);
      if (exportHasta) params.set('hasta', exportHasta);
      if (filter !== 'todos') params.set('estado', filter);
      if (filtroTipoVenta !== 'todos') params.set('tipo_venta', filtroTipoVenta);
      const res  = await fetch(`/api/admin/export-orders?${params}`);
      if (!res.ok) throw new Error('Error');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `pedidos_${exportDesde || 'todos'}_${exportHasta || 'hoy'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV descargado');
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const updateStatus = async (orderId: string, estado: OrderEstado) => {
    setLoading(orderId);
    const res  = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, estado }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); }
    else { setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, estado } : o)); toast.success('Estado actualizado'); }
    setLoading(null);
  };

  const approveTransfer = async (orderId: string) => {
    setLoading(orderId);
    const res  = await fetch(`/api/admin/orders/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); }
    else {
      setOrders((prev) => prev.map((o) =>
        o.id === orderId ? { ...o, estado: 'pagado', stock_descontado: true, comprobante_revisado: true } : o
      ));
      toast.success('✅ Pago aprobado y stock descontado');
    }
    setLoading(null);
  };

  const rejectTransfer = async () => {
    if (!rejectModal || !rejectMotivo.trim()) { toast.error('Ingresá el motivo'); return; }
    setLoading(rejectModal.orderId);
    const res  = await fetch(`/api/admin/orders/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rejectModal.orderId, motivo: rejectMotivo }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); }
    else {
      setOrders((prev) => prev.map((o) =>
        o.id === rejectModal.orderId
          ? { ...o, estado: 'rechazado', comprobante_revisado: true, rejection_reason: rejectMotivo }
          : o
      ));
      toast.success('❌ Comprobante rechazado — cliente notificado');
      setRejectModal(null);
      setRejectMotivo('');
    }
    setLoading(null);
  };

  const markPaidWithStock = async (orderId: string) => {
    setLoading(orderId);
    const res  = await fetch('/api/admin/orders/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); }
    else {
      setOrders((prev) => prev.map((o) =>
        o.id === orderId ? { ...o, estado: 'pagado', stock_descontado: true } : o
      ));
      toast.success('Pedido marcado como pagado y stock descontado');
    }
    setLoading(null);
  };

  // ── Quick filter tabs ────────────────────────────────────────
  const filterTabs = [
    { id: 'todos',         label: 'Todos',          count: orders.length },
    { id: 'pendiente',     label: 'Pendientes',      count: orders.filter(o => o.estado === 'pendiente').length },
    { id: 'comprobante',   label: '📎 Comprobantes', count: pendingComprobanteCount, special: true },
    { id: 'pagado',        label: 'Pagados',         count: orders.filter(o => o.estado === 'pagado').length },
    { id: 'enviado',       label: 'Enviados',        count: orders.filter(o => o.estado === 'enviado').length },
  ];

  // Special filter: comprobantes to review
  const effectiveFilter = filter === 'comprobante'
    ? orders.filter(o => o.metodo_pago === 'transferencia' && o.comprobante_url && !o.comprobante_revisado)
    : filtered;

  // ── Verificación de retiro en local (código + DNI) ──────────────────
  type RetiroOrder = Order & {
    retiro_dni_titular?: string | null;
    retiro_retira_tercero?: boolean;
    retiro_tercero_nombre?: string | null;
    retiro_tercero_dni?: string | null;
  };
  const [retiroCodigo, setRetiroCodigo] = React.useState('');
  const [retiroDni, setRetiroDni] = React.useState('');
  const [retiroResult, setRetiroResult] = React.useState<RetiroOrder | null>(null);
  const [retiroError, setRetiroError] = React.useState<string | null>(null);
  const [retiroLoading, setRetiroLoading] = React.useState(false);
  const [retiroConfirming, setRetiroConfirming] = React.useState(false);
  const [retiroSuccess, setRetiroSuccess] = React.useState<string | null>(null);

  async function buscarRetiro(e: React.FormEvent) {
    e.preventDefault();
    if (!retiroCodigo.trim()) return;
    setRetiroLoading(true);
    setRetiroResult(null);
    setRetiroError(null);
    setRetiroSuccess(null);
    setRetiroDni('');
    const res = await fetch(`/api/admin/verify-retiro?codigo=${retiroCodigo.trim().toUpperCase()}`);
    const json = await res.json();
    if (res.ok) setRetiroResult(json.data);
    else setRetiroError(json.error);
    setRetiroLoading(false);
  }

  async function confirmarRetiro() {
    if (!retiroDni.trim()) { toast.error('Ingresá el DNI de quien retira'); return; }
    setRetiroConfirming(true);
    setRetiroError(null);
    try {
      const res = await fetch('/api/admin/verify-retiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: retiroCodigo.trim().toUpperCase(), dni: retiroDni.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setRetiroError(json.error); return; }
      setRetiroResult(json.data);
      setRetiroSuccess(`Retiro confirmado — entregado a ${json.retiradoPor}`);
      toast.success('Retiro confirmado ✅');
      setOrders((prev) => prev.map((o) => (o.id === json.data.id ? { ...o, ...json.data } : o)));
    } finally {
      setRetiroConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ✅ Exportar a CSV */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Desde</label>
          <input type="date" value={exportDesde} onChange={(e) => setExportDesde(e.target.value)} className="input-base text-sm py-1.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Hasta</label>
          <input type="date" value={exportHasta} onChange={(e) => setExportHasta(e.target.value)} className="input-base text-sm py-1.5" />
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-secondary gap-2 py-2 text-sm">
          {exporting
            ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> Exportando...</>
            : <>📊 Exportar CSV</>}
        </button>
        <p className="text-xs text-muted self-center">Incluye los filtros activos · compatible con Excel</p>
      </div>

      {/* ✅ Verificar retiro en local: código + DNI */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">🏪 Verificar retiro en local</h2>
        <form onSubmit={buscarRetiro} className="flex flex-wrap gap-3">
          <input
            value={retiroCodigo}
            onChange={(e) => { setRetiroCodigo(e.target.value.toUpperCase()); setRetiroResult(null); setRetiroError(null); setRetiroSuccess(null); }}
            placeholder="Código de retiro (8 caracteres)"
            maxLength={8}
            className="input-base py-2 text-sm font-mono tracking-widest w-56"
          />
          <button type="submit" disabled={retiroLoading || !retiroCodigo.trim()} className="btn-secondary gap-2 py-2 text-sm">
            {retiroLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
        </form>

        {retiroError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5"><XCircle size={14} /> {retiroError}</p>
        )}

        {retiroSuccess && (
          <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1.5"><CheckCircle size={14} /> {retiroSuccess}</p>
        )}

        {retiroResult && !retiroSuccess && (
          <div className="rounded-xl border border-border p-4 space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{retiroResult.nombre}</p>
                <p className="text-muted text-xs">{retiroResult.email} · Pedido #{retiroResult.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <span className={`badge ${ORDER_STATUS_COLORS[retiroResult.estado]}`}>{ORDER_STATUS_LABELS[retiroResult.estado]}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted mb-0.5">DNI del titular</p>
                <p className="font-mono">{retiroResult.retiro_dni_titular || '—'}</p>
              </div>
              {retiroResult.retiro_retira_tercero && (
                <div>
                  <p className="text-xs text-muted mb-0.5">Autorizado a retirar</p>
                  <p>{retiroResult.retiro_tercero_nombre} <span className="font-mono text-muted">({retiroResult.retiro_tercero_dni})</span></p>
                </div>
              )}
            </div>

            {retiroResult.estado === 'entregado' ? (
              <p className="text-xs text-muted">✅ Este pedido ya fue retirado.</p>
            ) : (
              <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                <div>
                  <label className="block text-xs font-medium mb-1">DNI presentado por quien retira</label>
                  <input value={retiroDni} onChange={(e) => setRetiroDni(e.target.value)}
                    placeholder="Escaneá o tipeá el DNI"
                    className="input-base py-2 text-sm w-48" />
                </div>
                <button onClick={confirmarRetiro} disabled={retiroConfirming || !retiroDni.trim()}
                  className="btn-primary gap-2 py-2 text-sm">
                  {retiroConfirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Confirmar retiro
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o ID…"
            className="input-base pl-9 py-2 text-sm" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="input-base w-auto py-2 text-sm">
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{ORDER_STATUS_LABELS[e]}</option>)}
        </select>
      </div>

      {/* Quick filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map(({ id, label, count, special }) => (
          <button key={id} onClick={() => setFilter(id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium border transition-all',
              filter === id
                ? special
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-brand-500 border-brand-500 text-white'
                : 'border-border text-muted hover:border-brand-400',
              special && count > 0 && filter !== id && 'border-green-400 text-green-600 bg-green-50 dark:bg-green-950/20'
            )}>
            {label} {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
          </button>
        ))}
      </div>

      {/* Real-time indicator */}
      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Actualizaciones en tiempo real activas
      </div>

      <p className="text-xs text-muted">{effectiveFilter.length} pedido{effectiveFilter.length !== 1 ? 's' : ''}</p>

      {/* Orders list */}
      <div className="space-y-3">
        {effectiveFilter.map((order) => {
          const hasComprobanteToReview =
            order.metodo_pago === 'transferencia' &&
            order.comprobante_url &&
            !order.comprobante_revisado &&
            order.estado === 'pendiente';

          return (
            <div key={order.id} className={cn(
              'card overflow-hidden',
              hasComprobanteToReview && 'ring-2 ring-green-400 dark:ring-green-600'
            )}>
              {/* Header */}
              <div
                className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-surface-2 transition-colors"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <ChevronDown size={16} className={cn('text-muted transition-transform', expanded === order.id && 'rotate-180')} />
                <span className="font-mono text-xs text-muted">#{order.id.slice(0,8).toUpperCase()}</span>
                <span className="font-medium text-sm flex-1 min-w-0 truncate">{order.nombre}</span>

                {/* Comprobante badge */}
                {hasComprobanteToReview && (
                  <span className="badge bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 gap-1">
                    <FileCheck size={11} /> Comprobante pendiente
                  </span>
                )}

                <span className="text-xs text-muted hidden sm:block">{formatDate(order.created_at)}</span>
                <span className={`badge ${ORDER_STATUS_COLORS[order.estado]}`}>{ORDER_STATUS_LABELS[order.estado]}</span>
                {(order as Order & {tipo_venta?: string}).tipo_venta === 'minorista' && (
                  <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 text-[10px]">
                    🏪 Minorista
                  </span>
                )}
                <span className="font-bold text-brand-600 text-sm">{formatPrice(order.total)}</span>
              </div>

              {/* Expanded */}
              {expanded === order.id && (
                <div className="border-t border-border p-4 space-y-4 animate-fade-in">
                  {/* Info grid */}
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <p className="text-xs text-muted mb-1">Contacto</p>
                      <p>{order.email}</p>
                      {order.telefono && <p className="text-muted">{order.telefono}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Dirección</p>
                      <p>{order.direccion}, {order.ciudad} ({order.codigo_postal})</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Método de pago</p>
                      <p className="capitalize">{order.metodo_pago}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted mb-1">Tipo de entrega</p>
                      <p className="flex items-center gap-1.5">
                        {(order as Order & { tipo_entrega?: string }).tipo_entrega === 'retiro'
                          ? <span className="badge bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">🏪 Retiro en local</span>
                          : <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">🚚 Envío a domicilio</span>}
                      </p>
                    </div>
                    {/* ✅ Código de retiro — visible al admin para validar en el local */}
                    {(order as Order & { tipo_entrega?: string; codigo_retiro?: string }).tipo_entrega === 'retiro' &&
                      (order as Order & { codigo_retiro?: string }).codigo_retiro && (
                      <div>
                        <p className="text-xs text-muted mb-1">Código de retiro</p>
                        <p className="font-mono text-lg font-black tracking-widest text-green-700 dark:text-green-400">
                          {(order as Order & { codigo_retiro?: string }).codigo_retiro}
                        </p>
                      </div>
                    )}
                    {order.tipo_entrega === 'retiro' && order.retiro_dni_titular && (
                      <div>
                        <p className="text-xs text-muted mb-1">DNI del titular</p>
                        <p className="font-mono">{order.retiro_dni_titular}</p>
                      </div>
                    )}
                    {order.tipo_entrega === 'retiro' && order.retiro_retira_tercero && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted mb-1">Autorizado a retirar (no es el titular)</p>
                        <p>{order.retiro_tercero_nombre} <span className="font-mono text-muted">— DNI {order.retiro_tercero_dni}</span></p>
                      </div>
                    )}
                    {order.tipo_entrega === 'retiro' && order.retirado_at && (
                      <div>
                        <p className="text-xs text-muted mb-1">Retirado</p>
                        <p>{formatDate(order.retirado_at)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted mb-1">Stock</p>
                      <p>{order.stock_descontado ? '✅ Descontado' : '⏳ Pendiente'}</p>
                    </div>
                    {(order as Order & { rejection_reason?: string }).rejection_reason && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted mb-1">Motivo de rechazo</p>
                        <p className="text-red-600 dark:text-red-400">{(order as Order & { rejection_reason?: string }).rejection_reason}</p>
                      </div>
                    )}
                    {order.notas && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted mb-1">Notas del cliente</p>
                        <p className="text-muted italic">{order.notas}</p>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-xs text-muted mb-2">Productos</p>
                    {(order.order_items ?? []).map((item) => (
                      <div key={item.id} className="py-1.5 border-b border-border last:border-0">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">
                            {item.nombre_snap} · {PACK_CONFIG[item.tipo_pack]?.label} ×{item.cantidad_packs} ({item.unidades} uds)
                            {item.variant_snap && ` · ${item.variant_snap}`}
                          </span>
                          <span>{formatPrice(item.subtotal)}</span>
                        </div>
                        {/* ✅ Pack surtido (curva B2B) — lista de preparación para el vendedor */}
                        {item.curva_breakdown && item.curva_breakdown.length > 0 && (
                          <div className="mt-1.5 ml-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2">
                            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
                              📦 Preparar este pack surtido:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.curva_breakdown.map((c, i) => (
                                <span key={i} className="text-[11px] bg-white dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 font-medium">
                                  {c.cantidad}× Talla {c.talla} / {c.color}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between font-bold mt-2">
                      <span>Total</span>
                      <span className="text-brand-600">{formatPrice(order.total)}</span>
                    </div>
                  </div>

                  {/* Comprobante */}
                  {order.comprobante_url && (
                    <a href={order.comprobante_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline">
                      <ExternalLink size={14} /> Ver comprobante de transferencia
                    </a>
                  )}

                  {/* ── ACCIONES ──────────────────────────────── */}
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-border">

                    {/* Estado selector */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted">Estado:</label>
                      <select
                        value={order.estado}
                        onChange={(e) => updateStatus(order.id, e.target.value as OrderEstado)}
                        disabled={!!loading}
                        className="input-base py-1.5 text-xs w-auto"
                      >
                        {ESTADOS.map((e) => <option key={e} value={e}>{ORDER_STATUS_LABELS[e]}</option>)}
                      </select>
                    </div>

                    {/* ✅ Avisar por WhatsApp — abre el chat con un mensaje ya
                         armado según el estado del pedido (y el código de
                         retiro + DNI si corresponde). No es un envío
                         automático: el admin confirma y manda desde su
                         WhatsApp, tal como se usa el botón de WhatsApp del
                         resto del sitio. */}
                    {(() => {
                      const waLink = buildOrderWhatsAppLink(order);
                      return waLink ? (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:brightness-95 text-white px-4 py-1.5 text-xs font-semibold transition-all">
                          <MessageCircle size={13} /> Avisar por WhatsApp
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 rounded-xl bg-surface-2 text-muted px-4 py-1.5 text-xs" title="El pedido no tiene teléfono cargado">
                          <MessageCircle size={13} /> Sin teléfono
                        </span>
                      );
                    })()}

                    {/* ✅ APROBAR COMPROBANTE */}
                    {hasComprobanteToReview && (
                      <button
                        onClick={() => approveTransfer(order.id)}
                        disabled={!!loading}
                        className="flex items-center gap-1.5 rounded-xl bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
                      >
                        {loading === order.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <CheckCircle size={13} />}
                        Aprobar comprobante
                      </button>
                    )}

                    {/* ❌ RECHAZAR COMPROBANTE */}
                    {hasComprobanteToReview && (
                      <button
                        onClick={() => { setRejectModal({ orderId: order.id }); setRejectMotivo(''); }}
                        disabled={!!loading}
                        className="flex items-center gap-1.5 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
                      >
                        <XCircle size={13} /> Rechazar comprobante
                      </button>
                    )}

                    {/* Mark paid (MP orders without webhook) */}
                    {order.metodo_pago === 'mercadopago' && !order.stock_descontado && order.estado !== 'cancelado' && (
                      <button
                        onClick={() => markPaidWithStock(order.id)}
                        disabled={!!loading}
                        className="btn-primary py-1.5 text-xs gap-1.5"
                      >
                        {loading === order.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <CheckCircle size={13} />}
                        Confirmar pago manual
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {effectiveFilter.length === 0 && (
          <div className="card p-12 text-center text-muted">
            <Clock size={32} className="mx-auto mb-3 opacity-20" />
            <p>No hay pedidos que coincidan con los filtros.</p>
          </div>
        )}
      </div>

      {/* ── Reject Modal ───────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setRejectModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface shadow-2xl p-6 animate-scale-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 dark:bg-red-950/30 p-2">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold">Rechazar comprobante</h3>
                <p className="text-xs text-muted">El cliente será notificado por email.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5">Motivo del rechazo *</label>
              <textarea
                value={rejectMotivo}
                onChange={(e) => setRejectMotivo(e.target.value)}
                placeholder="Ej: El comprobante no es legible, el monto no corresponde, la fecha es incorrecta…"
                rows={3}
                className="input-base resize-none text-sm"
                autoFocus
              />
              <p className="text-xs text-muted mt-1">Este texto se enviará al cliente.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1 text-sm">
                Cancelar
              </button>
              <button
                onClick={rejectTransfer}
                disabled={!rejectMotivo.trim() || !!loading}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Rechazar y notificar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
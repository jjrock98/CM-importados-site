'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Package, CheckCircle2, Clock, Truck, Store, XCircle, ReceiptText } from 'lucide-react';
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/utils';
import type { Order } from '@/types';
import { cn } from '@/utils';

const ESTADO_ICON: Record<string, React.ReactNode> = {
  pendiente:      <Clock       size={20} className="text-yellow-500" />,
  pendiente_pago: <Clock       size={20} className="text-orange-500" />,
  pagado:         <CheckCircle2 size={20} className="text-green-500" />,
  procesando:     <Package     size={20} className="text-blue-500"  />,
  enviado:        <Truck       size={20} className="text-purple-500" />,
  entregado:      <CheckCircle2 size={20} className="text-teal-500" />,
  cancelado:      <XCircle     size={20} className="text-red-500"   />,
};

export function SeguimientoContent() {
  const params = useSearchParams();

  // Pre-fill from URL params (coming from /pedido-confirmado)
  const [orderId, setOrderId] = useState(params.get('id') ?? '');
  const [email,   setEmail]   = useState(params.get('email') ?? '');
  const [order,   setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const buscar = useCallback(async () => {
    if (!orderId.trim() || !email.trim()) {
      setError('Completá el número de pedido y el email');
      return;
    }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res  = await fetch(
        `/api/seguimiento?id=${orderId.trim()}&email=${encodeURIComponent(email.trim())}`
      );
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Pedido no encontrado'); return; }
      setOrder(json.data);
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [orderId, email]);

  // Auto-search if params come from /pedido-confirmado
  useEffect(() => {
    if (params.get('id') && params.get('email')) buscar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex rounded-full bg-brand-50 dark:bg-brand-950/20 p-4 mb-4">
          <Search size={28} className="text-brand-600" />
        </div>
        <h1 className="font-display text-3xl font-bold">Seguimiento de pedido</h1>
        <p className="text-muted mt-2">Ingresá tu número de pedido y email para ver el estado.</p>
      </div>

      {/* Form */}
      <div className="card p-6 space-y-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Número de pedido <span className="text-red-400">*</span>
          </label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.toUpperCase())}
            placeholder="Ej: A1B2C3D4"
            className="input-base font-mono uppercase"
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <p className="text-[10px] text-muted mt-1">
            Lo encontrás en el email de confirmación o en el comprobante.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Email con el que compraste <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="input-base"
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
        </div>
        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1.5">
            <XCircle size={14} /> {error}
          </p>
        )}
        <button
          onClick={buscar}
          disabled={loading}
          className="btn-primary w-full gap-2 justify-center"
        >
          {loading
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <Search size={15} />}
          {loading ? 'Buscando...' : 'Ver estado del pedido'}
        </button>
      </div>

      {/* Result */}
      {order && (
        <div className="space-y-4 animate-slide-up-fade">
          {/* Header */}
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">Pedido</p>
                <p className="font-mono text-xl font-black text-brand-600">
                  #{order.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-muted mt-0.5">{formatDate(order.created_at)}</p>
              </div>
              <div className="text-right">
                <span className={cn('badge text-xs', ORDER_STATUS_COLORS[order.estado])}>
                  {ESTADO_ICON[order.estado]}
                  <span className="ml-1">{ORDER_STATUS_LABELS[order.estado]}</span>
                </span>
                <p className="text-lg font-bold text-brand-600 mt-2">{formatPrice(order.total)}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">Estado del pedido</h3>
            {(['pendiente','pagado','procesando',
               order.tipo_entrega === 'retiro' ? 'entregado' : 'enviado',
               order.tipo_entrega === 'retiro' ? null : 'entregado',
            ] as (string | null)[])
              .filter(Boolean)
              .map((step, i, arr) => {
                const estados = ['pendiente','pendiente_pago','pagado','procesando','enviado','entregado'];
                const currentIdx = estados.indexOf(order.estado);
                const stepIdx    = estados.indexOf(step!);
                const done       = currentIdx >= stepIdx && order.estado !== 'cancelado' && order.estado !== 'rechazado';
                const active     = step === order.estado;
                return (
                  <div key={step} className="flex items-start gap-3 mb-3 last:mb-0">
                    <div className={cn(
                      'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      done
                        ? 'border-green-500 bg-green-500'
                        : active
                          ? 'border-brand-500 bg-brand-500'
                          : 'border-border bg-surface'
                    )}>
                      {done && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', !done && 'text-muted')}>
                        {ORDER_STATUS_LABELS[step!] ?? step}
                      </p>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="absolute left-[22px] h-3 w-0.5 bg-border mt-5" />
                    )}
                  </div>
                );
            })}
            {(order.estado === 'cancelado' || order.estado === 'rechazado') && (
              <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {order.estado === 'rechazado' ? '❌ Pedido rechazado.' : '❌ Pedido cancelado.'}
                  {order.rejection_reason && ` Motivo: ${order.rejection_reason}`}
                </p>
              </div>
            )}
          </div>

          {/* Productos */}
          {order.order_items && order.order_items.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ReceiptText size={15} /> Detalle
              </h3>
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted">
                      {item.nombre_snap}
                      <span className="text-xs ml-1 opacity-60">
                        ({item.tipo_pack === 'unidad' ? `${item.cantidad_packs} uds` : item.tipo_pack === 'media_docena' ? '½ doc' : 'doc'} ×{item.cantidad_packs})
                      </span>
                    </span>
                    <span className="font-medium">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-brand-600">{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Entrega */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              {order.tipo_entrega === 'retiro' ? <Store size={15} /> : <Truck size={15} />}
              {order.tipo_entrega === 'retiro' ? 'Retiro en local' : 'Envío a domicilio'}
            </h3>
            {order.tipo_entrega !== 'retiro' && (
              <p className="text-sm text-muted">
                {order.direccion}, {order.ciudad} (CP {order.codigo_postal})
              </p>
            )}
          </div>

          <div className="text-center pt-2">
            <Link href="/productos" className="btn-ghost text-sm gap-2">
              <Package size={15} /> Ver más productos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
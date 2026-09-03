import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatPrice, formatDate, ORDER_STATUS_LABELS } from '@/utils';
import type { Order } from '@/types';

export const metadata = { title: 'Pedido recibido' };
export const dynamic  = 'force-dynamic';

interface Props {
  searchParams: { orderId?: string }
}

export default async function PagoExitosoPage({ searchParams }: Props) {
  const { orderId } = searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let order: Order | null = null;

  if (orderId && user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('orders')
      .select('*, order_items(nombre_snap, tipo_pack, cantidad_packs, subtotal)')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();
    order = (data ?? null) as Order | null;
  }

  if (!order) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <Clock size={60} className="text-brand-400" />
        <h1 className="font-display text-2xl font-bold">Pedido en proceso</h1>
        <p className="text-muted max-w-sm text-sm">
          Tu pedido está siendo procesado. Recibirás un email de confirmación en breve.
        </p>
        <Link href="/mis-pedidos" className="btn-primary">Ver mis pedidos</Link>
      </div>
    );
  }

  // Transferencia pendiente de comprobante
  if (order.metodo_pago === 'transferencia' && !order.comprobante_url) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="rounded-2xl bg-yellow-50 dark:bg-yellow-950/20 p-5">
          <AlertCircle size={48} className="text-yellow-500 mx-auto" />
        </div>
        <h1 className="font-display text-2xl font-bold">¡Pedido creado!</h1>
        <p className="text-muted max-w-sm text-sm">
          Para confirmar tu pedido, subí el comprobante de la transferencia.
        </p>
        <div className="card p-4 text-left text-sm w-full max-w-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">Pedido</span>
            <span className="font-mono font-bold">#{order.id.slice(0,8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Total</span>
            <span className="font-bold text-brand-600">{formatPrice(order.total)}</span>
          </div>
        </div>
        <Link href={`/subir-comprobante?orderId=${order.id}`} className="btn-primary">
          Subir comprobante →
        </Link>
      </div>
    );
  }

  // Pedido confirmado
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="text-center mb-8">
        <CheckCircle2 size={72} className="text-green-500 mx-auto mb-4 animate-scale-in" />
        <h1 className="font-display text-3xl font-bold mb-2">¡Pedido confirmado!</h1>
        <p className="text-muted">
          Te enviamos la confirmación a <strong>{order.email}</strong>.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">Número de pedido</p>
            <p className="font-mono font-bold text-lg">#{order.id.slice(0,8).toUpperCase()}</p>
          </div>
          <span className={`badge px-3 py-1 bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400`}>
            {ORDER_STATUS_LABELS[order.estado]}
          </span>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          {(order.order_items ?? []).map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted line-clamp-1 flex-1">
                {item.nombre_snap} × {item.cantidad_packs}
              </span>
              <span>{formatPrice(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <span>Envío</span><span>{formatPrice(order.costo_envio)}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-brand-600">{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="border-t border-border pt-3 text-xs text-muted space-y-1">
          <p>{formatDate(order.created_at)}</p>
          <p className="capitalize">{order.metodo_pago}</p>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Link href="/mis-pedidos" className="btn-primary flex-1 text-center">
          Ver mis pedidos
        </Link>
        <Link href="/" className="btn-secondary flex-1 text-center">
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}

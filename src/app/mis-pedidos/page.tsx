import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/utils';
import { PACK_CONFIG } from '@/types';
import { Package2, ChevronRight, ExternalLink } from 'lucide-react';
import type { Order } from '@/types';
import { RepetirPedidoButton } from '@/components/orders/RepetirPedidoButton';

export const metadata = { title: 'Mis pedidos' };
export const dynamic  = 'force-dynamic';

export default async function MisPedidosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/mis-pedidos');

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(product_id, variant_id, nombre_snap, imagen_snap, tipo_pack, cantidad_packs, subtotal, products(slug, imagenes))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const list = (orders ?? []) as Order[];

  if (list.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Package2 size={56} className="text-muted opacity-30" />
        <p className="text-muted font-medium">No tenés pedidos aún.</p>
        <Link href="/" className="btn-primary">Ver productos</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-bold">Mis pedidos</h1>
        <span className="text-sm text-muted">
          {list.length} pedido{list.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-4">
        {list.map((order) => (
          <Link
            key={order.id}
            href={`/mis-pedidos/${order.id}`}
            className="card block p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-in"
          >
            {/* Header row */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-mono text-muted">
                  #{order.id.slice(0,8).toUpperCase()}
                </p>
                <p className="text-xs text-muted mt-0.5">{formatDate(order.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${ORDER_STATUS_COLORS[order.estado]}`}>
                  {ORDER_STATUS_LABELS[order.estado]}
                </span>
                <span className="font-bold text-brand-600">{formatPrice(order.total)}</span>
                <ChevronRight size={16} className="text-muted" />
              </div>
            </div>

            {/* Items preview */}
            <div className="space-y-1 mb-3">
              {(order.order_items ?? []).slice(0, 2).map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted line-clamp-1 flex-1">
                    {item.nombre_snap} · {PACK_CONFIG[item.tipo_pack]?.label ?? item.tipo_pack} ×{item.cantidad_packs}
                  </span>
                  <span className="shrink-0 ml-3">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
              {(order.order_items ?? []).length > 2 && (
                <p className="text-xs text-muted">
                  + {(order.order_items ?? []).length - 2} producto{(order.order_items ?? []).length - 2 !== 1 ? 's' : ''} más
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted">
              <span>Envío: {order.costo_envio > 0 ? formatPrice(order.costo_envio) : (order.tipo_entrega === 'retiro' ? 'Retiro en local' : 'A coordinar')}</span>
              <span>·</span>
              <span className="capitalize">{order.metodo_pago}</span>

              {order.comprobante_url && (
                <>
                  <span>·</span>
                  <span
                    onClick={(e) => { e.preventDefault(); window.open(order.comprobante_url!, '_blank'); }}
                    className="flex items-center gap-1 text-brand-600 hover:underline cursor-pointer"
                  >
                    <ExternalLink size={11} /> Comprobante
                  </span>
                </>
              )}

              {/* CTAs inline */}
              {order.estado === 'pendiente' && order.metodo_pago === 'transferencia' && !order.comprobante_url && (
                <>
                  <span>·</span>
                  <span
                    onClick={(e) => { e.preventDefault(); window.location.href = `/subir-comprobante?orderId=${order.id}`; }}
                    className="text-brand-600 hover:underline font-medium cursor-pointer"
                  >
                    Subir comprobante →
                  </span>
                </>
              )}

              <span>·</span>
              <RepetirPedidoButton
                items={(order.order_items ?? []).map((item) => ({
                  productId:    item.product_id,
                  productSlug:  item.products?.slug ?? '',
                  nombre:       item.nombre_snap,
                  imagen:       item.imagen_snap ?? item.products?.imagenes?.[0] ?? '',
                  tipoPack:     item.tipo_pack,
                  cantidadPacks: item.cantidad_packs,
                  unidades:     item.cantidad_packs * (item.tipo_pack === 'media_docena' ? 6 : item.tipo_pack === 'docena' ? 12 : 1),
                  precioUnit:   item.subtotal / item.cantidad_packs,
                  variantId:    item.variant_id ?? null,
                  variantLabel: item.variant_snap ?? null,
                }))}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderConfirmationEmail, sendAdminOrderStatusEmail } from '@/lib/email';
import { sendAdminPushNotification } from '@/lib/webpush';
import type { Order } from '@/types';

/**
 * Marcar un pedido como pagado manualmente desde el admin (sin pasar
 * por el flujo de aprobar comprobante — ej: el cliente pagó en efectivo
 * en persona, o por otro medio coordinado directamente).
 *
 * REGLA DE NEGOCIO 2B/3: si el pedido es de método manual (transferencia),
 * el stock YA fue reservado al crearse (reservar_stock_orden_manual).
 * Este endpoint NO debe volver a descontar — solo confirma el estado.
 * Si por algún motivo llega acá sin stock reservado, lo reserva ahora
 * como fallback defensivo.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { orderId } = await req.json();
  const admin = createAdminClient();

  const { data: existingOrder } = await admin
    .from('orders').select('estado, stock_descontado, nombre, total').eq('id', orderId).single();
  if (!existingOrder) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  if (existingOrder.estado === 'pagado') {
    return NextResponse.json({ error: 'Este pedido ya está marcado como pagado' }, { status: 409 });
  }

  if (!existingOrder.stock_descontado) {
    // Fallback defensivo: reservar ahora si por algún motivo no se
    // reservó al crear el pedido (no debería ocurrir en el flujo normal).
    const { data: result } = await admin.rpc('reservar_stock_orden_manual', { p_order_id: orderId });
    if (!result?.success) {
      return NextResponse.json({
        error: result?.error || 'Lo sentimos, el producto ya no se encuentra disponible',
      }, { status: 409 });
    }
  }

  await admin.from('orders').update({
    estado:      'pagado',
    reviewed_by: user.id,
    fecha_pago:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }).eq('id', orderId);

  const { data: order } = await admin.from('orders').select('*, order_items(*)').eq('id', orderId).single();
  if (order) {
    const o = order as Order;
    sendOrderConfirmationEmail(o).catch(console.error);
    sendAdminOrderStatusEmail(o, `✅ Pedido marcado como pagado manualmente — #${o.id.slice(0,8).toUpperCase()}`).catch(console.error);
    sendAdminPushNotification({
      title: '✅ Pedido pagado',
      body:  `Pedido #${o.id.slice(0,8).toUpperCase()} de ${o.nombre} marcado como pagado.`,
      tag:   'order-paid',
      data:  { url: '/admin/pedidos' },
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderStatusEmail, sendAdminOrderStatusEmail } from '@/lib/email';
import { sendAdminPushNotification } from '@/lib/webpush';
import type { Order } from '@/types';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body    = await req.json().catch(() => ({}));
  const orderId = body.id ?? body.orderId;
  const motivo  = body.motivo?.trim();
  if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 });
  if (!motivo)  return NextResponse.json({ error: 'El motivo de rechazo es obligatorio' }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  if (order.metodo_pago !== 'transferencia') {
    return NextResponse.json({ error: 'Solo aplica para pagos por transferencia' }, { status: 400 });
  }
  if (order.estado === 'cancelado') {
    return NextResponse.json({ error: 'El pedido ya fue cancelado' }, { status: 409 });
  }

  // ══════════════════════════════════════════════════════════════════════
  // REGLA DE NEGOCIO 3 — Restock automático al rechazar
  // Con el flujo nuevo, el stock SIEMPRE está reservado/descontado desde
  // el momento de crear el pedido (reservar_stock_orden_manual). Al
  // rechazar el comprobante, se devuelve ese stock al inventario público.
  // ══════════════════════════════════════════════════════════════════════
  if (order.stock_descontado) {
    const { data: restoreResult } = await admin.rpc('devolver_stock_seguro', {
      p_order_id: orderId,
    });
    if (!restoreResult?.success) {
      // ⚠️ FIX crítico: antes esto solo logueaba el error y seguía
      // adelante igual, cancelando el pedido de todos modos. Eso dejaba
      // el stock "perdido" para siempre (descontado del inventario pero
      // nunca devuelto, con el pedido ya marcado como cancelado — nadie
      // se enteraba). Ahora se frena la operación y se le pide al admin
      // reintentar, en vez de perder stock silenciosamente.
      console.error('[reject] Error restaurando stock:', restoreResult);
      return NextResponse.json({
        error: 'No se pudo restaurar el stock de este pedido. El rechazo se canceló para no perder inventario — reintentá en unos segundos o revisá el stock manualmente antes de forzar el rechazo.',
      }, { status: 500 });
    }
  }

  const { error } = await admin.from('orders').update({
    estado:               'cancelado',
    rejection_reason:      motivo,
    comprobante_revisado:  true,
    reviewed_by:           user.id,
    updated_at:            new Date().toISOString(),
  }).eq('id', orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: cancelledOrder } = await admin
    .from('orders').select('*, order_items(*)').eq('id', orderId).single();

  if (cancelledOrder) {
    const o = cancelledOrder as Order;

    // ✅ MÓDULO 5 — Email al cliente (usa el helper centralizado, no new Resend() directo)
    sendOrderStatusEmail(o).catch(console.error);

    // ✅ MÓDULO 5 — Notificación al admin
    sendAdminOrderStatusEmail(o,
      `❌ Comprobante rechazado — Pedido #${o.id.slice(0,8).toUpperCase()}`
    ).catch(console.error);

    // ✅ MÓDULO 5 — Push al dispositivo del admin
    sendAdminPushNotification({
      title: '❌ Comprobante rechazado',
      body:  `Pedido #${o.id.slice(0,8).toUpperCase()} de ${o.nombre}. Motivo: ${motivo}`,
      tag:   'transfer-rejected',
      data:  { url: '/admin/pedidos' },
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}

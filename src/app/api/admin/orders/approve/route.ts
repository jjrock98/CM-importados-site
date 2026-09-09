import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderConfirmationEmail, sendAdminOrderStatusEmail } from '@/lib/email';
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
  if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 });

  const admin = createAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('id, metodo_pago, comprobante_url, estado, stock_descontado, nombre, total')
    .eq('id', orderId)
    .single();

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  if (order.metodo_pago !== 'transferencia') {
    return NextResponse.json({ error: 'Solo se pueden aprobar pagos por transferencia' }, { status: 400 });
  }
  if (!order.comprobante_url) {
    return NextResponse.json({ error: 'El cliente aún no subió el comprobante' }, { status: 400 });
  }
  if (order.estado === 'pagado') {
    return NextResponse.json({ error: 'El pedido ya fue procesado' }, { status: 409 });
  }

  // ══════════════════════════════════════════════════════════════════════
  // REGLA DE NEGOCIO 2B — El stock YA fue reservado (descontado) al
  // momento de crear el pedido, vía reservar_stock_orden_manual().
  // Aprobar el comprobante NO vuelve a tocar products.stock_unidades —
  // solo confirma la venta cambiando el estado a 'pagado'.
  // ══════════════════════════════════════════════════════════════════════
  if (!order.stock_descontado) {
    // Caso defensivo: si por algún motivo el pedido llegó acá sin
    // stock reservado (no debería pasar en el flujo normal), se
    // intenta reservar ahora antes de aprobar.
    const { data: reserva } = await admin.rpc('reservar_stock_orden_manual', {
      p_order_id: orderId,
    });
    if (!reserva?.success) {
      return NextResponse.json({
        error: reserva?.error ?? 'No hay stock suficiente para aprobar este pedido',
      }, { status: 409 });
    }
  }

  await admin.from('orders').update({
    estado:               'pagado',
    comprobante_revisado: true,
    reviewed_by:          user.id,
    fecha_pago:           new Date().toISOString(),
    updated_at:           new Date().toISOString(),
  }).eq('id', orderId);

  // ✅ El dashboard de /admin cachea sus números por 60s (revalidate = 60).
  // Sin esto, un cambio de estado tardaba hasta un minuto en reflejarse
  // ahí. revalidatePath fuerza a recalcularlo en el próximo request.
  revalidatePath('/admin');

  const { data: fullOrder } = await admin
    .from('orders').select('*, order_items(*)').eq('id', orderId).single();

  if (fullOrder) {
    const o = fullOrder as Order;
    // ⚠️ Se espera (await) antes de responder — ver nota en upload-comprobante/route.ts:
    // sin esto, la función serverless puede cortar el fetch de email/push/Telegram
    // a mitad de camino apenas se manda la respuesta de más abajo.
    await Promise.all([
      sendOrderConfirmationEmail(o).catch(console.error),
      sendAdminOrderStatusEmail(o,
        `✅ Transferencia aprobada — Pedido #${o.id.slice(0,8).toUpperCase()}`
      ).catch(console.error),
      sendAdminPushNotification({
        title: '✅ Transferencia aprobada',
        body:  `Pedido #${o.id.slice(0,8).toUpperCase()} de ${o.nombre} — ${
          new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(o.total)
        }`,
        tag:  'transfer-approved',
        data: { url: '/admin/pedidos' },
      }).catch(console.error),
    ]);
  }

  return NextResponse.json({ ok: true, message: 'Pago aprobado' });
}
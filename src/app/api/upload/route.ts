import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadComprobanteSchema, parseBody } from '@/lib/validations';
import { rateLimiters } from '@/lib/rateLimit';
import { sendAdminOrderStatusEmail } from '@/lib/email';
import type { Order } from '@/types';

export async function POST(req: NextRequest) {
  const limited = rateLimiters.upload(req);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const rawBody = await req.json().catch(() => null);
    const { data, error: validErr } = parseBody(uploadComprobanteSchema, rawBody);
    if (validErr) return NextResponse.json({ error: validErr }, { status: 422 });
    if (!data)   return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 });

    // ✅ Validar que la URL pertenece al bucket de Supabase (seguridad)
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprobantes/`;
    if (!data.comprobanteUrl.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'URL de comprobante inválida' }, { status: 422 });
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select('id, user_id, estado, stock_descontado')
      .eq('id', data.orderId)
      .single();

    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    if (order.estado === 'cancelado' || order.estado === 'rechazado' || order.estado === 'pagado') {
      return NextResponse.json({ error: 'Este pedido ya no admite comprobantes' }, { status: 409 });
    }

    // ══════════════════════════════════════════════════════════════════════
    // El stock YA fue reservado (descontado) al crear el pedido, vía
    // reservar_stock_orden_manual (ver /api/orders). Subir el comprobante
    // solo guarda la URL y cambia el estado — no vuelve a tocar stock.
    // ══════════════════════════════════════════════════════════════════════
    const { error } = await admin
      .from('orders')
      .update({
        comprobante_url: data.comprobanteUrl,
        estado:          'pendiente_pago',
        updated_at:      new Date().toISOString(),
      })
      .eq('id', data.orderId);

    if (error) throw error;

    // Notificar al admin (email + push) para que revise
    const { data: updatedOrder } = await admin
      .from('orders').select('*, order_items(*)').eq('id', data.orderId).single();
    if (updatedOrder) {
      sendAdminOrderStatusEmail(
        updatedOrder as Order,
        '📎 Nuevo comprobante de transferencia subido — pendiente de revisión'
      ).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Error al guardar comprobante' }, { status: 500 });
  }
}
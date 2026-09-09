import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminPushNotification } from '@/lib/webpush';

// ✅ Next 16: params ahora es una Promise, hay que await-earlo
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  // Verificar que el pedido pertenece al usuario
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, nombre, estado, stock_descontado')
    .eq('id', id)
    .single();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  // Solo se pueden cancelar pedidos pendientes sin stock descontado
  if (order.estado !== 'pendiente') {
    return NextResponse.json({
      error: `No se puede cancelar un pedido en estado "${order.estado}". Solo se pueden cancelar pedidos pendientes.`,
    }, { status: 409 });
  }

  if (order.stock_descontado) {
    return NextResponse.json({
      error: 'El pago ya fue procesado. Contactanos para gestionar la devolución.',
    }, { status: 409 });
  }

  const { error } = await admin
    .from('orders')
    .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ✅ El cliente cancelando su propio pedido también mueve el conteo de
  // "Pendientes de pago" del dashboard — mismo motivo que en los
  // endpoints de admin, se refresca al instante.
  revalidatePath('/admin');

  // ⚠️ Se espera (await) antes de responder — ver nota en upload-comprobante/route.ts
  await sendAdminPushNotification({
    title: '❌ Pedido cancelado por el cliente',
    body:  `Pedido #${id.slice(0,8).toUpperCase()} de ${order.nombre} fue cancelado. Revisá stock/logística.`,
    tag:   'order-cancelled',
    data:  { url: '/admin/pedidos' },
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
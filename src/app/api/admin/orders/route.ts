import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderStatusEmail } from '@/lib/email';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

export async function PATCH(req: NextRequest) {
  const admin_user = await verifyAdmin();
  if (!admin_user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { orderId, estado } = await req.json();
  const admin = createAdminClient();

  // ══════════════════════════════════════════════════════════════════
  // FIX crítico: este endpoint genérico es la ÚNICA vía para cancelar
  // pedidos pagados con Mercado Pago o cuenta corriente desde el admin
  // (el flujo de "rechazar" en /orders/reject solo aplica a
  // transferencia). Antes, cambiar el estado acá a 'cancelado' NO
  // restauraba el stock reservado ni revertía el saldo de cuenta
  // corriente — el stock quedaba perdido para siempre y el cliente
  // seguía debiendo un pedido cancelado. Se agrega esa lógica acá,
  // igual que ya la tienen approve/reject/mark-paid.
  //
  // 'rechazado' es un estado final negativo igual que 'cancelado'
  // (el admin lo rechaza por pago no acreditado, comprobante apócrifo,
  // etc.) — debe restaurar stock/saldo exactamente igual si se llega a
  // setear desde este selector genérico, para no repetir el mismo bug.
  // ══════════════════════════════════════════════════════════════════
  const { data: current } = await admin
    .from('orders')
    .select('estado, metodo_pago, stock_descontado, user_id, total')
    .eq('id', orderId)
    .single();

  if (!current) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

  const ESTADOS_FINALES_NEGATIVOS = ['cancelado', 'rechazado'];
  const pasaACancelado =
    ESTADOS_FINALES_NEGATIVOS.includes(estado) &&
    !ESTADOS_FINALES_NEGATIVOS.includes(current.estado);

  if (pasaACancelado && current.stock_descontado) {
    const { data: restoreResult } = await admin.rpc('devolver_stock_seguro', { p_order_id: orderId });
    if (!restoreResult?.success) {
      console.error('[orders PATCH] Error restaurando stock al cancelar:', restoreResult);
      return NextResponse.json({
        error: 'No se pudo restaurar el stock de este pedido. Cambio de estado cancelado para no perder inventario — reintentá en unos segundos.',
      }, { status: 500 });
    }
  }

  if (pasaACancelado && current.metodo_pago === 'cuenta_corriente' && current.user_id) {
    const { error: saldoErr } = await admin.rpc('sumar_saldo_cuenta_corriente', {
      p_profile_id: current.user_id,
      p_monto: -current.total, // revierte la deuda que se había sumado al crear el pedido
    });
    if (saldoErr) {
      console.error('[orders PATCH] Error revirtiendo saldo de cuenta corriente:', saldoErr);
      // No se frena la cancelación por esto (el stock ya se restauró, que es
      // lo más urgente) — pero se deja loggeado para ajuste manual si falla.
    }
  }

  const { data: order, error } = await admin
    .from('orders')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('*, order_items(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send status email
  if (order) sendOrderStatusEmail(order).catch(console.error);

  return NextResponse.json({ ok: true });
}
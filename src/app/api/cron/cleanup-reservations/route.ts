import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderExpiredEmail } from '@/lib/email';
import type { Order } from '@/types';

/**
 * ══════════════════════════════════════════════════════════════════════
 * REGLA DE NEGOCIO 3 — Expiración automática de pedidos con pago manual
 * ══════════════════════════════════════════════════════════════════════
 * Se ejecuta vía Vercel Cron (ver vercel.json) cada hora.
 *
 * Lee el tiempo límite configurado por el admin en site_settings
 * ('retencion_horas_transferencia', en horas). Para cada pedido con
 * metodo_pago='transferencia' que:
 *   - sigue en estado 'pendiente' o 'pendiente_pago' (no fue aprobado ni
 *     rechazado todavía), Y
 *   - tiene el stock reservado (stock_descontado = true, reservado al
 *     momento de crear el pedido), Y
 *   - superó el tiempo límite desde su creación
 *
 * ...se ejecuta la secuencia completa:
 *   a) Cancela la orden (estado → 'cancelado')
 *   b) Restock explícito vía devolver_stock_seguro (las unidades
 *      vuelven al inventario público de inmediato)
 *   c) Envía email al cliente avisando la expiración
 *
 * Nota: los pedidos de Mercado Pago en 'pendiente_pago' (cupón de
 * efectivo Rapipago/Pago Fácil) NUNCA reservaron stock (Regla 2A),
 * así que su expiración solo cancela la orden — no hay nada que
 * restockear porque nunca se descontó nada.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.REVALIDATE_SECRET_TOKEN) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = createAdminClient();

  // ── 1. Leer configuración de retención (admin-configurable) ─────────────
  const { data: settingRow } = await admin
    .from('site_settings')
    .select('valor')
    .eq('clave', 'retencion_horas_transferencia')
    .single();

  const retencionHoras = Number(settingRow?.valor ?? 48); // fallback: 48hs
  const cutoffManual = new Date(Date.now() - retencionHoras * 60 * 60 * 1000).toISOString();

  // ── 2. Buscar pedidos manuales expirados con stock reservado ─────────────
  const { data: expiredManualOrders } = await admin
    .from('orders')
    .select('*, order_items(*)')
    .eq('metodo_pago', 'transferencia')
    .in('estado', ['pendiente', 'pendiente_pago'])
    .eq('stock_descontado', true)
    .lt('created_at', cutoffManual);

  let cancelledCount = 0;
  let restockErrors  = 0;
  let emailErrors    = 0;

  for (const order of expiredManualOrders ?? []) {
    // a) Restock explícito ANTES de cancelar, para no dejar ventana
    //    donde el pedido ya esté cancelado pero el stock siga afuera.
    const { data: restore } = await admin.rpc('devolver_stock_seguro', {
      p_order_id: order.id,
    });

    if (!restore?.success) {
      console.error(`[cron] Error restaurando stock del pedido ${order.id}:`, restore);
      restockErrors++;
      continue; // No cancelar si el restock falló — se reintenta en la próxima corrida
    }

    // b) Cancelar la orden
    const { error: cancelErr } = await admin
      .from('orders')
      .update({
        estado: 'cancelado',
        rejection_reason: `Pedido cancelado automáticamente: expiró el tiempo límite de ${retencionHoras}hs para pagos manuales sin confirmar.`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (cancelErr) {
      console.error(`[cron] Error cancelando pedido ${order.id}:`, cancelErr);
      continue;
    }

    cancelledCount++;

    // c) Email al cliente
    try {
      await sendOrderExpiredEmail(order as Order);
    } catch (err) {
      console.error(`[cron] Error enviando email de expiración para ${order.id}:`, err);
      emailErrors++;
    }

    // Log de auditoría
    void admin.from('notificaciones_admin').insert({
      tipo: 'email', evento: 'order_expired_restock', order_id: order.id, enviado: emailErrors === 0,
    });
  }

  // ── 3. Cancelar cupones de efectivo (MP) vencidos — sin restock ─────────
  // Estos NUNCA reservaron stock (Regla 2A), así que no hay nada que devolver.
  const cutoffCash = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: expiredCashOrders } = await admin
    .from('orders')
    .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
    .eq('estado', 'pendiente_pago')
    .eq('metodo_pago', 'mercadopago')
    .eq('stock_descontado', false)
    .lt('created_at', cutoffCash)
    .select('id');

  // ✅ Este cron cancela pedidos automáticamente por fuera de cualquier
  // acción del admin — igual conviene refrescar el dashboard para que
  // "Pendientes de pago" no quede desactualizado hasta el próximo minuto.
  revalidatePath('/admin');

  return NextResponse.json({
    ok:        true,
    timestamp: new Date().toISOString(),
    retencionHorasConfigurada: retencionHoras,
    resultado: {
      pedidos_manuales_expirados_y_restockeados: cancelledCount,
      errores_restock:  restockErrors,
      errores_email:    emailErrors,
      cupones_efectivo_mp_cancelados: expiredCashOrders?.length ?? 0,
    },
  });
}
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminPushNotification } from '@/lib/webpush';
import { secretsMatch } from '@/lib/secureCompare';

/**
 * ══════════════════════════════════════════════════════════════════════
 * FEATURE 4 — Alertas de quiebre de stock por variante (talle/color)
 * ══════════════════════════════════════════════════════════════════════
 * Se ejecuta vía Vercel Cron (ver vercel.json) cada pocos minutos.
 *
 * El trigger de Postgres `trg_quiebre_variante` (sql/schema.sql) detecta
 * cuando una variante (talle/color específico) cae a 0 unidades e
 * inserta un registro en `notificaciones_admin` con
 * evento='variante_quiebre_stock' y enviado=false. No puede disparar el
 * push directo desde Postgres (necesitaría extensiones adicionales tipo
 * pg_net), así que este cron barre esos registros pendientes y manda la
 * notificación push real al admin, marcando enviado=true al terminar
 * (o guardando el error si el push falla).
 *
 * El campo `error` de notificaciones_admin se reutiliza para guardar el
 * payload "product_id|variant_id|talla|color" que dejó el trigger — no
 * es un error real en este caso, es el encoding más simple sin agregar
 * columnas nuevas a una tabla que ya es genérica para email + push.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secretsMatch(secret, process.env.REVALIDATE_SECRET_TOKEN)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: pendientes, error: fetchErr } = await admin
    .from('notificaciones_admin')
    .select('id, error')
    .eq('tipo', 'push')
    .eq('evento', 'variante_quiebre_stock')
    .eq('enviado', false)
    .order('created_at', { ascending: true })
    .limit(50);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!pendientes || pendientes.length === 0) {
    return NextResponse.json({ ok: true, procesadas: 0 });
  }

  let enviadas = 0;
  let fallidas = 0;

  for (const notif of pendientes) {
    // Formato guardado por el trigger: "product_id|variant_id|talla|color"
    const [productId, variantId, talla, color] = (notif.error ?? '').split('|');

    try {
      // Verificar que la variante siga agotada (evita mandar una alerta
      // vieja si alguien restockeó entre que se disparó el trigger y que
      // corrió este cron — el trigger ya resetea alerta_quiebre_enviada
      // al restockear, pero por las dudas se re-chequea acá también).
      const { data: variant } = await admin
        .from('product_variants')
        .select('stock_unidades, products(nombre)')
        .eq('id', variantId)
        .single();

      if (!variant || variant.stock_unidades > 0) {
        // Ya no aplica — se marca como procesada sin enviar push
        await admin.from('notificaciones_admin').update({ enviado: true }).eq('id', notif.id);
        continue;
      }

      const nombreProducto = (variant.products as unknown as { nombre: string } | null)?.nombre ?? 'Producto';

      await sendAdminPushNotification({
        title: '⚠️ Quiebre de stock por talle/color',
        body: `${nombreProducto} — Talle ${talla} / ${color} se agotó`,
        tag: `quiebre-variante-${variantId}`,
        data: { url: `/admin/productos?highlight=${productId}` },
      });

      await admin.from('notificaciones_admin').update({ enviado: true }).eq('id', notif.id);
      enviadas++;
    } catch (err) {
      console.error('[stock-alerts] Error procesando notificación', notif.id, err);
      fallidas++;
    }
  }

  return NextResponse.json({ ok: true, procesadas: pendientes.length, enviadas, fallidas });
}
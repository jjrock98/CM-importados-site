import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAdminPushNotification } from '@/lib/webpush';
import { rateLimiters } from '@/lib/rateLimit';
import { secretsMatch } from '@/lib/secureCompare';

/**
 * POST /api/send-notification
 *
 * Endpoint centralizado para disparar notificaciones Web Push al
 * administrador. Hasta ahora, `sendAdminPushNotification()` se llamaba
 * directamente desde cada ruta (approve, reject, mark-paid, webhook de
 * MP) — este endpoint permite dispararlas también desde otros lugares
 * (cron jobs, triggers manuales, futuras integraciones) sin duplicar
 * la lógica de armado del payload.
 *
 * Protegido: solo admins autenticados, o llamadas internas del propio
 * servidor con el REVALIDATE_SECRET_TOKEN (igual patrón que los crons).
 *
 * Body esperado:
 * {
 *   "title": "Nuevo pedido",
 *   "body":  "Pedido #ABC123 de Juan Pérez",
 *   "tag":   "new-order",          // opcional, agrupa notificaciones similares
 *   "data":  { "url": "/admin/pedidos" },  // opcional, a dónde navega al hacer click
 *   "orderId": "uuid-del-pedido"   // opcional, para el log de auditoría
 * }
 */
export async function POST(req: NextRequest) {
  const limited = rateLimiters.notifications(req);
  if (limited) return limited;

  // ── Autorización: admin logueado O secret interno (para crons/servidor) ──
  const internalSecret = req.headers.get('x-internal-secret');
  const isInternalCall = secretsMatch(internalSecret, process.env.REVALIDATE_SECRET_TOKEN);

  if (!isInternalCall) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
    if (profile?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? '').trim();
  const text  = String(body?.body  ?? '').trim();

  if (!title || !text) {
    return NextResponse.json({ error: 'title y body son requeridos' }, { status: 422 });
  }
  if (title.length > 100 || text.length > 300) {
    return NextResponse.json({ error: 'title (máx 100) o body (máx 300) demasiado largos' }, { status: 422 });
  }

  const admin = createAdminClient();

  try {
    await sendAdminPushNotification({
      title,
      body: text,
      tag:  body?.tag ? String(body.tag).slice(0, 50) : undefined,
      data: body?.data && typeof body.data === 'object' ? body.data : undefined,
    });

    // Auditoría — mismo patrón que el resto del sistema (notificaciones_admin)
    void admin.from('notificaciones_admin').insert({
      tipo:     'push',
      evento:   body?.tag ?? 'manual_notification',
      order_id: body?.orderId ?? null,
      enviado:  true,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[send-notification] Error:', err);

    void admin.from('notificaciones_admin').insert({
      tipo:     'push',
      evento:   body?.tag ?? 'manual_notification',
      order_id: body?.orderId ?? null,
      enviado:  false,
      error:    err instanceof Error ? err.message : 'Error desconocido',
    });

    return NextResponse.json({ error: 'Error al enviar la notificación' }, { status: 500 });
  }
}
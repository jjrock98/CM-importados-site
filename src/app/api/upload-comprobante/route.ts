import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimiters } from '@/lib/rateLimit';
import { sendAdminOrderStatusEmail } from '@/lib/email';
import { sendAdminPushNotification } from '@/lib/webpush';
import type { Order } from '@/types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB, igual que el bucket

/**
 * POST /api/upload-comprobante (multipart/form-data)
 *
 * Reemplaza el flujo anterior (subida directa a Supabase Storage desde
 * el cliente + /api/upload) por uno unificado que sube el archivo desde
 * el servidor con el service role — así funciona tanto para usuarios
 * logueados como para invitados sin cuenta, que antes quedaban
 * completamente bloqueados (la policy de storage exigía auth.uid()).
 *
 * Campos del FormData:
 *   - orderId:  requerido
 *   - file:     requerido (imagen o PDF, máx 10MB)
 *   - email:    requerido SOLO si el pedido es de invitado (user_id null),
 *               se valida contra el email guardado en el pedido — mismo
 *               patrón de identidad ya usado en /api/seguimiento.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimiters.upload(req);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await req.formData();
    const orderId = formData.get('orderId');
    const email   = formData.get('email');
    const file    = formData.get('file');

    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json({ error: 'orderId requerido' }, { status: 422 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 422 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Usá JPG, PNG, WEBP o PDF' }, { status: 422 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo no puede superar 10MB' }, { status: 422 });
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select('id, user_id, email, estado, stock_descontado')
      .eq('id', orderId)
      .single();

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    // ── Validar identidad: dueño logueado, o invitado con email correcto ──
    if (order.user_id) {
      if (!user || user.id !== order.user_id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
    } else {
      const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!emailStr || emailStr !== order.email.toLowerCase()) {
        return NextResponse.json({ error: 'Email no coincide con el pedido' }, { status: 403 });
      }
    }

    if (order.estado === 'cancelado' || order.estado === 'pagado') {
      return NextResponse.json({ error: 'Este pedido ya no admite comprobantes' }, { status: 409 });
    }

    // ── Subir el archivo al bucket privado 'comprobantes' con service role ──
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const folder = order.user_id ?? 'invitados';
    const path = `${folder}/${orderId}-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from('comprobantes')
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = admin.storage.from('comprobantes').getPublicUrl(path);

    const sessionId = req.headers.get('x-session-id') ?? '';
    // Nota: el bucket es privado (RLS exige dueño o admin para leer), así
    // que aunque getPublicUrl arma una URL "pública", solo el admin o el
    // dueño autenticado pueden efectivamente descargarla — es la misma
    // guardia que ya usaba el flujo anterior.
    void sessionId; // se mantiene el header por compatibilidad con el cliente, sin uso adicional acá

    const { error } = await admin
      .from('orders')
      .update({
        comprobante_url: publicUrl,
        estado:          'pendiente_pago',
        updated_at:      new Date().toISOString(),
      })
      .eq('id', orderId);
    if (error) throw error;

    const { data: updatedOrder } = await admin
      .from('orders').select('*, order_items(*)').eq('id', orderId).single();
    if (updatedOrder) {
      sendAdminOrderStatusEmail(
        updatedOrder as Order,
        '📎 Nuevo comprobante de transferencia subido — pendiente de revisión'
      ).catch(console.error);
      sendAdminPushNotification({
        title: '📎 Comprobante subido',
        body:  `Pedido #${String(updatedOrder.id).slice(0,8).toUpperCase()} de ${(updatedOrder as Order).nombre} — listo para verificar.`,
        tag:   'order-comprobante',
        data:  { url: '/admin/pedidos' },
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Upload comprobante error:', err);
    return NextResponse.json({ error: 'Error al subir el comprobante' }, { status: 500 });
  }
}
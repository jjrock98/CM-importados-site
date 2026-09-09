import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimiters } from '@/lib/rateLimit';
import { sendAdminOrderStatusEmail } from '@/lib/email';
import { sendAdminPushNotification } from '@/lib/webpush';
import type { Order } from '@/types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB, igual que el bucket

// ── Validación de contenido real (magic bytes) ──────────────────────
// file.type es lo que el NAVEGADOR declara — un atacante puede armar un
// FormData a mano y poner cualquier Content-Type sin que el archivo
// real sea lo que dice ser (ej: un .exe o .html con script disfrazado
// de "imagen.jpg"). Esto chequea los primeros bytes del archivo contra
// la firma real de cada formato permitido, así el contenido tiene que
// coincidir con lo que declara — no alcanza con cambiarle la extensión
// o mentir el Content-Type.
function detectarTipoReal(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  // WEBP: 'RIFF' .... 'WEBP'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  // PDF: '%PDF-'
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) return 'application/pdf';
  return null;
}

// ── Escaneo de virus / contenido malicioso embebido ─────────────────
// Cloudmersive Virus Scan API (free tier: 800 escaneos/mes, sin costo).
// El modo "advanced" no solo busca firmas de virus conocidas — también
// detecta ejecutables, scripts y macros escondidos DENTRO de un archivo
// que por afuera parece un PDF/imagen válido (lo que las magic bytes de
// arriba no pueden ver, porque solo miran los primeros bytes).
//
// Requiere la variable de entorno CLOUDMERSIVE_API_KEY en Vercel
// (Settings → Environment Variables). Sacás la key gratis en
// https://account.cloudmersive.com tras registrarte.
//
// Diseño "fail-open": si el servicio de Cloudmersive no responde (caído,
// se acabó la cuota gratuita del mes, timeout de red), NO se bloquea la
// subida — se deja pasar y se loguea la falla. La alternativa (fail-closed)
// dejaría a tus clientes sin poder pagar por transferencia cada vez que
// un servicio gratuito de terceros tenga un problema, lo cual es peor
// para el negocio que el riesgo marginal de un archivo sin escanear en
// esa ventana. Si preferís lo contrario (bloquear si el escaneo falla),
// avisame y lo invertimos.
async function escanearVirus(
  bytes: Buffer, filename: string, mimeType: string
): Promise<{ ok: boolean; motivo?: string }> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY;
  if (!apiKey) {
    console.warn('[AV] CLOUDMERSIVE_API_KEY no configurada — se omite el escaneo de virus');
    return { ok: true };
  }

  try {
    const form = new FormData();
    // 🔧 as unknown as BlobPart: las definiciones de tipos de Node/TS más
    // nuevas volvieron más estricto BlobPart (exige ArrayBuffer puro, no
    // ArrayBufferLike) y rompieron la compatibilidad con Buffer/Uint8Array
    // en TODO el ecosistema — es un problema del chequeo de tipos, no de
    // comportamiento real: en runtime esto siempre funcionó bien.
    form.append('inputFile', new Blob([bytes as unknown as BlobPart], { type: mimeType }), filename);

    const res = await fetch('https://api.cloudmersive.com/virus/scan/file/advanced', {
      method: 'POST',
      headers: { Apikey: apiKey },
      body: form,
    });

    if (!res.ok) {
      console.error('[AV] Cloudmersive respondió', res.status, await res.text().catch(() => ''));
      return { ok: true }; // fail-open — ver nota arriba
    }

    const result = await res.json();
    const amenaza =
      result.CleanResult === false ||
      result.ContainsExecutable ||
      result.ContainsScript ||
      result.ContainsMacros ||
      result.ContainsHtml ||
      result.ContainsInvalidFile ||
      result.ContainsXmlExternalEntities ||
      result.ContainsInsecureDeserialization;

    if (amenaza) {
      console.warn('[AV] Archivo rechazado por el escaneo de virus:', JSON.stringify(result));
      return { ok: false, motivo: result.FoundViruses?.[0]?.VirusName ?? 'contenido no permitido' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[AV] Error llamando a Cloudmersive:', err);
    return { ok: true }; // fail-open — ver nota arriba
  }
}

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

    if (order.estado === 'cancelado' || order.estado === 'rechazado' || order.estado === 'pagado') {
      return NextResponse.json({ error: 'Este pedido ya no admite comprobantes' }, { status: 409 });
    }

    // ── Subir el archivo al bucket privado 'comprobantes' con service role ──
    const bytes = Buffer.from(await file.arrayBuffer());

    // ⚠️ El contenido real tiene que coincidir con lo que declaró el
    // navegador. Si alguien renombra un ejecutable a "comprobante.jpg" y
    // fuerza el Content-Type, esto lo detecta y lo rechaza acá — antes
    // de que llegue a guardarse en el bucket.
    const tipoReal = detectarTipoReal(bytes);
    if (!tipoReal || tipoReal !== file.type) {
      return NextResponse.json(
        { error: 'El archivo no es válido o no coincide con su formato declarado' },
        { status: 422 }
      );
    }

    const scan = await escanearVirus(bytes, file.name, tipoReal);
    if (!scan.ok) {
      return NextResponse.json(
        { error: 'El archivo no pasó la validación de seguridad. Probá con otro archivo o contactanos por WhatsApp.' },
        { status: 422 }
      );
    }

    const ext  = file.name.split('.').pop() ?? 'jpg';
    const folder = order.user_id ?? 'invitados';
    const path = `${folder}/${orderId}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await admin.storage
      .from('comprobantes')
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (uploadErr) throw uploadErr;

    const sessionId = req.headers.get('x-session-id') ?? '';
    void sessionId; // se mantiene el header por compatibilidad con el cliente, sin uso adicional acá

    // ⚠️ FIX: antes se guardaba getPublicUrl(path), pero el bucket
    // 'comprobantes' es privado — esa URL "pública" nunca funcionó para
    // nadie (ni admin ni cliente), porque Supabase Storage la rechaza
    // sin importar las políticas de RLS. Ahora se guarda el path crudo;
    // la URL para verlo se genera al vuelo (signed, con vencimiento
    // corto) desde /api/comprobante-url cuando alguien autorizado la pide.
    const { error } = await admin
      .from('orders')
      .update({
        comprobante_url: path,
        estado:          'pendiente_pago',
        updated_at:      new Date().toISOString(),
      })
      .eq('id', orderId);
    if (error) throw error;

    const { data: updatedOrder } = await admin
      .from('orders').select('*, order_items(*)').eq('id', orderId).single();
    if (updatedOrder) {
      // ⚠️ Se esperan (await) antes de responder: en runtime serverless de
      // Vercel una llamada "fire-and-forget" (sin await) corre el riesgo de
      // que la función termine su ejecución apenas se manda la respuesta,
      // cortando el fetch a Resend/Telegram/webpush a mitad de camino y
      // perdiendo la notificación sin ningún error visible. Promise.allSettled
      // para que un fallo de un canal (ej. email) no bloquee al otro (push).
      await Promise.allSettled([
        sendAdminOrderStatusEmail(
          updatedOrder as Order,
          '📎 Nuevo comprobante de transferencia subido — pendiente de revisión'
        ),
        sendAdminPushNotification({
          title: '📎 Comprobante subido',
          body:  `Pedido #${String(updatedOrder.id).slice(0,8).toUpperCase()} de ${(updatedOrder as Order).nombre} — listo para verificar.`,
          tag:   'order-comprobante',
          data:  { url: '/admin/pedidos' },
        }),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Upload comprobante error:', err);
    return NextResponse.json({ error: 'Error al subir el comprobante' }, { status: 500 });
  }
}
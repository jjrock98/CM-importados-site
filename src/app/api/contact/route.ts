import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendContactMessageEmail } from '@/lib/email';
import { sendAdminPushNotification } from '@/lib/webpush';
import { contactMessageSchema, parseBody } from '@/lib/validations';
import { rateLimiters } from '@/lib/rateLimit';
import { verifyTurnstile, getClientIp } from '@/lib/turnstile';

export async function POST(req: NextRequest) {
  const limited = rateLimiters.contact(req);
  if (limited) return limited;

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  // ✅ NUEVO: captcha (Cloudflare Turnstile) — se valida ANTES que el resto
  // del body para no gastar una consulta a Supabase ni mandar emails por un
  // request de bot. El token no es parte del schema de contactMessageSchema
  // porque no es un dato del mensaje en sí, así que se saca del rawBody acá.
  const { turnstileToken, ...bodyRest } = rawBody as Record<string, unknown>;
  const captchaOk = await verifyTurnstile(turnstileToken, getClientIp(req));
  if (!captchaOk) {
    return NextResponse.json({ error: 'Verificación anti-bot fallida. Recargá la página e intentá de nuevo.' }, { status: 403 });
  }

  const { data, error: validationError } = parseBody(contactMessageSchema, bodyRest);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 422 });

  // ✅ 'data' es non-null aquí porque parseBody devuelve error si falla
  if (!data) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 });

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('contact_messages').insert({
      nombre:  data.nombre,
      email:   data.email,
      asunto:  data.asunto ?? null,
      mensaje: data.mensaje,
    });
    if (error) throw error;

    // ⚠️ Se espera (await) antes de responder — ver nota en upload-comprobante/route.ts
    await Promise.all([
      sendContactMessageEmail(data.nombre, data.email, data.asunto ?? '', data.mensaje)
        .catch(console.error),
      sendAdminPushNotification({
        title: '💬 Nuevo mensaje de contacto',
        body:  `${data.nombre}: "${data.mensaje.slice(0, 80)}${data.mensaje.length > 80 ? '…' : ''}"`,
        tag:   'contact-new',
        data:  { url: '/admin/mensajes' },
      }).catch(console.error),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Contact error:', err);
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 });
  }
}
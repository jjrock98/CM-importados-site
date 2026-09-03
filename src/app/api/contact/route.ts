import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendContactMessageEmail } from '@/lib/email';
import { contactMessageSchema, parseBody } from '@/lib/validations';
import { rateLimiters } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const limited = rateLimiters.contact(req);
  if (limited) return limited;

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const { data, error: validationError } = parseBody(contactMessageSchema, rawBody);
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

    sendContactMessageEmail(data.nombre, data.email, data.asunto ?? '', data.mensaje)
      .catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Contact error:', err);
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 });
  }
}

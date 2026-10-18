import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth/verifyAdmin';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/env';
import { normalizeOrigin } from '@/lib/pushOrigin';

export async function POST(req: NextRequest) {
  const check = await checkAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const user = check.user;

  const body = await req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 422 });
  }

  // Origen desde el que se registró (lo manda el navegador). Se guarda
  // normalizado como "https://dominio" para detectar duplicados.
  let origin: string | null = null;
  try { origin = body.origin ? new URL(String(body.origin)).origin : null; } catch { origin = null; }

  // En producción solo se aceptan suscripciones hechas desde el dominio real
  // (NEXT_PUBLIC_APP_URL). Evita que localhost, el dominio de Vercel o una
  // app instalada de otro dominio dejen suscripciones duplicadas.
  const expected = normalizeOrigin(env.APP_URL);
  if (process.env.NODE_ENV === 'production' && expected && origin && normalizeOrigin(origin) !== expected) {
    return NextResponse.json(
      { error: `Solo se permite activar notificaciones desde ${env.APP_URL}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const row = {
    user_id:  user.id,
    endpoint: body.endpoint,
    p256dh:   body.keys.p256dh,
    auth:     body.keys.auth,
  };

  const { error } = await admin
    .from('push_subscriptions')
    .upsert({ ...row, origin }, { onConflict: 'endpoint' });

  if (error) {
    // Si todavía no se corrió la migración que agrega la columna "origin",
    // se guarda igual sin ella (no se pierde la suscripción).
    const { error: retryError } = await admin
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' });
    if (retryError) {
      console.error('[Push] No se pudo guardar la suscripción:', retryError);
      return NextResponse.json({ error: 'No se pudo guardar la suscripción' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { endpoint } = await req.json().catch(() => ({ endpoint: null }));
  if (!endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 422 });

  const admin = createAdminClient();
  await admin.from('push_subscriptions').delete()
    .eq('user_id', user.id).eq('endpoint', endpoint);

  return NextResponse.json({ ok: true });
}
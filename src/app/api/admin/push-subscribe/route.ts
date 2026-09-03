import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo para administradores' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 422 });
  }

  const admin = createAdminClient();
  await admin.from('push_subscriptions').upsert({
    user_id:  user.id,
    endpoint: body.endpoint,
    p256dh:   body.keys.p256dh,
    auth:     body.keys.auth,
  }, { onConflict: 'endpoint' });

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

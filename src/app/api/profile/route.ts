import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { profileUpdateSchema, parseBody } from '@/lib/validations';

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const rawBody = await req.json().catch(() => null);
  const { data, error: validErr } = parseBody(profileUpdateSchema, rawBody);
  if (validErr) return NextResponse.json({ error: validErr }, { status: 422 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile, error } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: profile });
}

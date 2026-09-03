import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();

  const { data, error } = await admin.from('products').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

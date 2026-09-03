import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return p?.rol === 'admin' ? user : null;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from('clientes_mayoristas').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

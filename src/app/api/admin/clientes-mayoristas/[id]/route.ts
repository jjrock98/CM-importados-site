import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/verifyAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from('clientes_mayoristas').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return p?.rol === 'admin' ? user : null;
}

/** GET /api/admin/clientes-mayoristas — lista todas las condiciones cargadas, con datos del perfil */
export async function GET() {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clientes_mayoristas')
    .select('*, profiles:profile_id(nombre, email)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** POST /api/admin/clientes-mayoristas — crea condición para un cliente (profile_id) */
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const body  = await req.json();
  if (!body.profile_id) return NextResponse.json({ error: 'profile_id requerido' }, { status: 422 });
  const admin = createAdminClient();
  const { data, error } = await admin.from('clientes_mayoristas').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** PATCH /api/admin/clientes-mayoristas — actualiza condición existente (por id) */
export async function PATCH(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id, ...body } = await req.json();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 422 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clientes_mayoristas')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

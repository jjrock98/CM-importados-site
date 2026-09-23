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

/** GET /api/admin/costos/settings — lista los gastos fijos (activos e inactivos). */
export async function GET() {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('cost_settings').select('*').order('nombre');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** POST /api/admin/costos/settings — crea un gasto fijo nuevo (ej. "Alquiler local"). */
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { nombre, monto_mensual } = await req.json();
  if (!nombre || typeof monto_mensual !== 'number' || monto_mensual < 0) {
    return NextResponse.json({ error: 'nombre y monto_mensual (>= 0) son obligatorios' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cost_settings')
    .insert({ nombre, monto_mensual })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** PUT /api/admin/costos/settings — actualiza nombre/monto/activo de un gasto fijo existente. */
export async function PUT(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id, nombre, monto_mensual, activo } = await req.json();
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (nombre !== undefined) patch.nombre = nombre;
  if (monto_mensual !== undefined) patch.monto_mensual = monto_mensual;
  if (activo !== undefined) patch.activo = activo;

  const admin = createAdminClient();
  const { data, error } = await admin.from('cost_settings').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** DELETE /api/admin/costos/settings?id=... — borra un gasto fijo. */
export async function DELETE(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('cost_settings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
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

// PATCH /api/admin/settings?table=bank_info|contact_info|location_info|site_settings
export async function PATCH(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const table = req.nextUrl.searchParams.get('table');
  const ALLOWED = ['bank_info', 'contact_info', 'location_info', 'site_settings'];
  if (!table || !ALLOWED.includes(table)) {
    return NextResponse.json({ error: 'Tabla no permitida' }, { status: 400 });
  }

  const body  = await req.json();
  const admin = createAdminClient();

  // site_settings uses key-value upsert
  if (table === 'site_settings') {
    const { clave, valor } = body;
    const { error } = await admin
      .from('site_settings')
      .update({ valor, updated_at: new Date().toISOString() })
      .eq('clave', clave);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Single-row tables: update the first row
  const { data: existing } = await admin.from(table).select('id').limit(1).single();
  if (!existing) return NextResponse.json({ error: 'Fila no encontrada' }, { status: 404 });

  const { error } = await admin
    .from(table)
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

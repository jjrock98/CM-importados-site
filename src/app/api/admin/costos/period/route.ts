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

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /api/admin/costos/period?periodo=YYYY-MM
 *
 * Devuelve las docenas_estimadas guardadas para el período (0 si
 * nunca se cargó), más una `docenas_sugeridas` calculada a partir de
 * las docenas realmente vendidas el mes calendario anterior — mismo
 * criterio de "pago confirmado" (pagado/procesando/enviado/entregado)
 * que usa el Dashboard admin. Es solo una sugerencia de referencia:
 * el campo real (docenas_estimadas) lo decide y carga el admin a
 * mano, porque es una proyección de negocio, no un dato que el
 * sistema pueda saber con certeza.
 */
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const periodo = req.nextUrl.searchParams.get('periodo') ?? periodoActual();
  const admin = createAdminClient();

  const { data: config } = await admin
    .from('cost_period_config').select('*').eq('periodo', periodo).maybeSingle();

  // Mes calendario anterior, para la sugerencia de referencia.
  const [y, m] = periodo.split('-').map(Number);
  const desde = new Date(Date.UTC(y, m - 2, 1));
  const hasta = new Date(Date.UTC(y, m - 1, 1));

  const { data: items } = await admin
    .from('order_items')
    .select('tipo_pack, cantidad_packs, orders!inner(estado, created_at)')
    .in('orders.estado', ['pagado', 'procesando', 'enviado', 'entregado'])
    .gte('orders.created_at', desde.toISOString())
    .lt('orders.created_at', hasta.toISOString());

  const docenasSugeridas = (items ?? []).reduce((acc, it: { tipo_pack: string; cantidad_packs: number }) => {
    const equivalenteDocenas = it.tipo_pack === 'docena' ? 1 : 0.5;
    return acc + it.cantidad_packs * equivalenteDocenas;
  }, 0);

  return NextResponse.json({
    periodo,
    docenas_estimadas: config?.docenas_estimadas ?? 0,
    docenas_sugeridas: Math.round(docenasSugeridas * 100) / 100,
  });
}

/**
 * PUT /api/admin/costos/period
 * body: { periodo: 'YYYY-MM', docenas_estimadas: number }
 */
export async function PUT(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { periodo, docenas_estimadas } = await req.json();
  if (!periodo || typeof docenas_estimadas !== 'number' || docenas_estimadas < 0) {
    return NextResponse.json({ error: 'periodo y docenas_estimadas (>= 0) son obligatorios' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cost_period_config')
    .upsert({ periodo, docenas_estimadas, updated_at: new Date().toISOString() }, { onConflict: 'periodo' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
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

/**
 * POST /api/admin/clientes-mayoristas/registrar-pago
 * Body: { profile_id: string, monto: number, concepto?: string }
 *
 * Registra que el cliente canceló (total o parcialmente) su deuda de
 * cuenta corriente. A diferencia del PATCH genérico de clientes-mayoristas
 * (que sobreescribe el saldo con lo que el frontend calculó), esto pasa
 * por el RPC `registrar_pago_cuenta_corriente`: resta de forma atómica
 * (sin condición de carrera si se cargan dos pagos casi juntos) y deja
 * el movimiento anotado en el historial que ve el cliente en /perfil.
 */
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const profileId = body?.profile_id;
  const monto = Number(body?.monto);
  const concepto = body?.concepto?.toString().trim() || null;

  if (!profileId) return NextResponse.json({ error: 'profile_id requerido' }, { status: 422 });
  if (!monto || monto <= 0) return NextResponse.json({ error: 'Ingresá un monto válido' }, { status: 422 });

  const admin = createAdminClient();
  const { data: nuevoSaldo, error } = await admin.rpc('registrar_pago_cuenta_corriente', {
    p_profile_id: profileId,
    p_monto: monto,
    p_admin_id: adminUser.id,
    p_concepto: concepto,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: condicion } = await admin
    .from('clientes_mayoristas')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  return NextResponse.json({ data: condicion, nuevoSaldo });
}

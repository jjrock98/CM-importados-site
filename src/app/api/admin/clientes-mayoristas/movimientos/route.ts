import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/verifyAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/clientes-mayoristas/movimientos?profile_id=XXX
 * Historial de cargos/pagos de cuenta corriente de un cliente puntual,
 * para que el admin pueda auditar de dónde salió el saldo actual.
 */
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const profileId = req.nextUrl.searchParams.get('profile_id');
  if (!profileId) return NextResponse.json({ error: 'profile_id requerido' }, { status: 422 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('movimientos_cuenta_corriente')
    .select('id, tipo, monto, saldo_resultante, concepto, order_id, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/mi-cuenta/movimientos
 * Historial de cuenta corriente del cliente logueado (cargos por compra +
 * pagos registrados por administración). Usa el cliente normal (no admin),
 * así que queda protegido por la policy RLS "cliente_ve_sus_movimientos"
 * — cada uno solo puede ver lo propio, sin necesidad de validar nada acá.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabase
    .from('movimientos_cuenta_corriente')
    .select('id, tipo, monto, saldo_resultante, concepto, order_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface CondicionesMayorista {
  descuento_fijo_pct: number;
  monto_minimo_pedido: number;
  limite_cuenta_corriente: number;
  saldo_cuenta_corriente: number;
  disponible_cuenta_corriente: number;
}

/**
 * GET /api/mi-cuenta/condiciones
 *
 * Devuelve las condiciones comerciales del cliente logueado: descuento fijo
 * (si tiene), monto mínimo de pedido que le aplica (el suyo particular si
 * tiene, si no el general del sitio) y su cuenta corriente si la tiene
 * habilitada. Usuarios invitados o sin condición particular reciben los
 * valores generales del sitio (descuento 0, mínimo general, sin cuenta
 * corriente disponible).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: settingRow } = await admin
    .from('site_settings')
    .select('valor')
    .eq('clave', 'monto_minimo_pedido')
    .single();
  const montoMinimoGeneral = settingRow ? Number(settingRow.valor) : 0;

  const base: CondicionesMayorista = {
    descuento_fijo_pct: 0,
    monto_minimo_pedido: montoMinimoGeneral,
    limite_cuenta_corriente: 0,
    saldo_cuenta_corriente: 0,
    disponible_cuenta_corriente: 0,
  };

  if (!user) return NextResponse.json({ data: base });

  const { data: condicion } = await admin
    .from('clientes_mayoristas')
    .select('*')
    .eq('profile_id', user.id)
    .eq('activo', true)
    .maybeSingle();

  if (!condicion) return NextResponse.json({ data: base });

  const disponible = Math.max(0, condicion.limite_cuenta_corriente - condicion.saldo_cuenta_corriente);

  return NextResponse.json({
    data: {
      descuento_fijo_pct: condicion.descuento_fijo_pct ?? 0,
      monto_minimo_pedido: condicion.monto_minimo_pedido ?? montoMinimoGeneral,
      limite_cuenta_corriente: condicion.limite_cuenta_corriente ?? 0,
      saldo_cuenta_corriente: condicion.saldo_cuenta_corriente ?? 0,
      disponible_cuenta_corriente: disponible,
    } satisfies CondicionesMayorista,
  });
}

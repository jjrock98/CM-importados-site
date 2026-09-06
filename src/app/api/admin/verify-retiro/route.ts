import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ORDER_SELECT =
  'id, nombre, email, telefono, estado, tipo_entrega, total, codigo_retiro, ' +
  'retiro_dni_titular, retiro_retira_tercero, retiro_tercero_nombre, retiro_tercero_dni, ' +
  'retirado_at, retirado_por, created_at, order_items(nombre_snap, cantidad_packs, tipo_pack)';

// Cast to a literal type so Supabase's query builder can infer the exact
// shape of the selected columns (a plain `string` type makes it fall back
// to `GenericStringError`, which is what caused the build failures below).
type OrderSelectRow = {
  id: string; nombre: string; email: string; telefono: string | null;
  estado: string; tipo_entrega: string; total: number; codigo_retiro: string | null;
  retiro_dni_titular: string | null; retiro_retira_tercero: boolean | null;
  retiro_tercero_nombre: string | null; retiro_tercero_dni: string | null;
  retirado_at: string | null; retirado_por: string | null; created_at: string;
  order_items: { nombre_snap: string; cantidad_packs: number; tipo_pack: string }[];
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return { user };
}

/**
 * GET /api/admin/verify-retiro?codigo=XXXXXXXX
 * Permite al personal del local buscar un pedido por código de retiro,
 * para ver quién debería estar retirándolo (titular o tercero autorizado)
 * antes de confirmar la entrega.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const codigo = req.nextUrl.searchParams.get('codigo')?.toUpperCase().trim();
  if (!codigo || codigo.length !== 8) {
    return NextResponse.json({ error: 'Código inválido (8 caracteres requeridos)' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from('orders')
    .select(ORDER_SELECT)
    .eq('codigo_retiro', codigo)
    .returns<OrderSelectRow[]>()
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'No se encontró ningún pedido con ese código' }, { status: 404 });
  }

  return NextResponse.json({ data: order });
}

/**
 * POST /api/admin/verify-retiro
 * Body: { codigo: string, dni: string }
 * Valida que el DNI ingresado por el personal del local coincida con el
 * titular del pedido o con el tercero autorizado, y si coincide marca el
 * pedido como entregado (retirado). Es el paso que efectivamente "cierra"
 * el retiro — el GET de arriba solo consulta, no entrega nada.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const codigo = body?.codigo?.toString().toUpperCase().trim();
  const dni = body?.dni?.toString().trim();

  if (!codigo || codigo.length !== 8) {
    return NextResponse.json({ error: 'Código inválido (8 caracteres requeridos)' }, { status: 400 });
  }
  if (!dni || dni.length < 6) {
    return NextResponse.json({ error: 'Ingresá el DNI de la persona que retira' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from('orders')
    .select(ORDER_SELECT)
    .eq('codigo_retiro', codigo)
    .returns<OrderSelectRow[]>()
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'No se encontró ningún pedido con ese código' }, { status: 404 });
  }

  if (order.estado === 'entregado') {
    return NextResponse.json({ error: 'Este pedido ya fue retirado anteriormente' }, { status: 409 });
  }
  if (order.estado === 'cancelado') {
    return NextResponse.json({ error: 'Este pedido está cancelado' }, { status: 409 });
  }
  if (order.estado === 'rechazado') {
    return NextResponse.json({ error: 'Este pedido fue rechazado (comprobante no válido)' }, { status: 409 });
  }
  if (!['pagado', 'procesando', 'enviado'].includes(order.estado)) {
    return NextResponse.json({ error: 'Este pedido todavía no está listo para retirar (falta confirmar el pago)' }, { status: 409 });
  }

  const dniCoincideTitular = order.retiro_dni_titular?.trim() === dni;
  const dniCoincideTercero = order.retiro_retira_tercero && order.retiro_tercero_dni?.trim() === dni;

  if (!dniCoincideTitular && !dniCoincideTercero) {
    return NextResponse.json({ error: 'El DNI ingresado no coincide con este pedido' }, { status: 403 });
  }

  const { data: updated, error: updateErr } = await admin
    .from('orders')
    .update({
      estado: 'entregado',
      retirado_at: new Date().toISOString(),
      retirado_por: auth.user!.id,
    })
    .eq('id', order.id)
    .select(ORDER_SELECT)
    .returns<OrderSelectRow[]>()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: 'No se pudo confirmar el retiro' }, { status: 500 });
  }

  return NextResponse.json({
    data: updated,
    retiradoPor: dniCoincideTercero ? order.retiro_tercero_nombre : order.nombre,
  });
}
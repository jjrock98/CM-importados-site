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

/** POST /api/admin/costos/settings — crea un gasto fijo nuevo.
 *  tipo 'fijo' (default): requiere nombre + monto_mensual.
 *  tipo 'por_dia' (ej. sueldo de un empleado que cobra por jornada):
 *  requiere nombre + dias_mes (> 0) + pago_por_dia (>= 0); monto_mensual
 *  se calcula acá mismo como dias_mes * pago_por_dia, nunca se recibe
 *  del cliente para este tipo (evita que quede desincronizado).
 */
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();
  const { nombre, tipo } = body;
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return NextResponse.json({ error: 'Falta el nombre del gasto' }, { status: 400 });
  }

  let insert: Record<string, unknown>;
  if (tipo === 'por_dia') {
    const dias_mes = Number(body.dias_mes);
    const pago_por_dia = Number(body.pago_por_dia);
    if (!Number.isFinite(dias_mes) || dias_mes <= 0 || !Number.isFinite(pago_por_dia) || pago_por_dia < 0) {
      return NextResponse.json({ error: 'dias_mes (> 0) y pago_por_dia (>= 0) son obligatorios' }, { status: 400 });
    }
    insert = { nombre, tipo: 'por_dia', dias_mes, pago_por_dia, monto_mensual: dias_mes * pago_por_dia };
  } else {
    const monto_mensual = Number(body.monto_mensual);
    if (!Number.isFinite(monto_mensual) || monto_mensual < 0) {
      return NextResponse.json({ error: 'nombre y monto_mensual (>= 0) son obligatorios' }, { status: 400 });
    }
    insert = { nombre, tipo: 'fijo', monto_mensual, dias_mes: null, pago_por_dia: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from('cost_settings').insert(insert).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** PUT /api/admin/costos/settings — actualiza un gasto fijo existente.
 *  Si se manda dias_mes o pago_por_dia (gasto tipo 'por_dia'), monto_mensual
 *  se recalcula acá con los valores resultantes — nunca se toma el
 *  monto_mensual que mande el cliente para ese tipo.
 */
export async function PUT(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id, nombre, monto_mensual, activo, tipo, dias_mes, pago_por_dia } = await req.json();
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (nombre !== undefined) patch.nombre = nombre;
  if (activo !== undefined) patch.activo = activo;

  const recalculaPorDia = dias_mes !== undefined || pago_por_dia !== undefined || tipo === 'por_dia';
  if (recalculaPorDia) {
    // Trae los valores actuales para completar el que no vino en este PUT
    // (ej. el admin solo tocó "días" y dejó "pago por día" como estaba).
    const { data: actual, error: errActual } = await admin
      .from('cost_settings').select('dias_mes, pago_por_dia').eq('id', id).single();
    if (errActual) return NextResponse.json({ error: errActual.message }, { status: 500 });

    const nuevoDias = dias_mes !== undefined ? Number(dias_mes) : Number(actual?.dias_mes ?? 0);
    const nuevoPago = pago_por_dia !== undefined ? Number(pago_por_dia) : Number(actual?.pago_por_dia ?? 0);
    if (!Number.isFinite(nuevoDias) || nuevoDias <= 0 || !Number.isFinite(nuevoPago) || nuevoPago < 0) {
      return NextResponse.json({ error: 'dias_mes (> 0) y pago_por_dia (>= 0) son obligatorios' }, { status: 400 });
    }
    patch.tipo = 'por_dia';
    patch.dias_mes = nuevoDias;
    patch.pago_por_dia = nuevoPago;
    patch.monto_mensual = nuevoDias * nuevoPago;
  } else if (tipo === 'fijo') {
    patch.tipo = 'fijo';
    patch.dias_mes = null;
    patch.pago_por_dia = null;
    if (monto_mensual !== undefined) patch.monto_mensual = monto_mensual;
  } else if (monto_mensual !== undefined) {
    // Edición de monto en un gasto 'fijo' sin cambiar el tipo.
    patch.monto_mensual = monto_mensual;
  }

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
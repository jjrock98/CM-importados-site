import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calcularRentabilidad, type EntradaRentabilidad, type LineaCosto } from '@/lib/rentabilidad';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esNumero = (v: unknown, min = 0, max = 1e12): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Valida y normaliza la entrada que llega del cliente. Devuelve null si algo no cierra. */
function normalizarEntrada(raw: unknown): EntradaRentabilidad | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  if (!Array.isArray(e.costosDirectos) || e.costosDirectos.length > 30) return null;
  const costosDirectos: LineaCosto[] = [];
  for (const l of e.costosDirectos) {
    const linea = l as Record<string, unknown>;
    if (!esNumero(linea?.monto)) return null;
    if (linea.moneda !== 'ARS' && linea.moneda !== 'USD') return null;
    costosDirectos.push({
      concepto: String(linea.concepto ?? 'Costo').trim().slice(0, 80) || 'Costo',
      monto: linea.monto,
      moneda: linea.moneda,
    });
  }

  const cot = e.cotizacionUsd;
  if (cot !== null && !esNumero(cot, 0.01)) return null;

  if (
    !esNumero(e.precioDocena) ||
    !esNumero(e.docenasCompra, 0.01) ||
    !esNumero(e.gastosFijosMensuales) ||
    !esNumero(e.docenasEstimadasMes) ||
    !esNumero(e.comisionPct, 0, 100) ||
    !esNumero(e.variableFijoDocena) ||
    !esNumero(e.margenObjetivoPct, 0, 99)
  ) return null;

  let imprevistos: EntradaRentabilidad['imprevistos'];
  if (e.imprevistos !== undefined && e.imprevistos !== null) {
    const imp = e.imprevistos as Record<string, unknown>;
    if (!esNumero(imp?.monto) || (imp.moneda !== 'ARS' && imp.moneda !== 'USD')) return null;
    imprevistos = { monto: imp.monto, moneda: imp.moneda };
  }

  return {
    imprevistos,
    precioDocena: e.precioDocena,
    docenasCompra: e.docenasCompra,
    costosDirectos,
    cotizacionUsd: cot as number | null,
    gastosFijosMensuales: e.gastosFijosMensuales,
    docenasEstimadasMes: e.docenasEstimadasMes,
    comisionPct: e.comisionPct,
    variableFijoDocena: e.variableFijoDocena,
    margenObjetivoPct: e.margenObjetivoPct,
  };
}

/** GET /api/admin/costos/simulaciones — últimas 50 simulaciones guardadas. */
export async function GET() {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cost_simulations')
    .select('id, nombre, product_id, precio_docena, docenas_compra, cotizacion_usd, cotizacion_origen, cotizacion_fecha, costo_real_docena, ganancia_docena, margen_pct, markup_pct, veredicto, notas, inputs, compra, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * POST /api/admin/costos/simulaciones
 *
 * Guarda simulaciones en el historial. Dos formas de body:
 *  - Un modelo:      { nombre, product_id?, notas?, cotizacion_origen?, cotizacion_fecha?, entrada }
 *  - Multimodelo:    { items: [{ nombre, product_id?, entrada }], compra, notas?, cotizacion_origen?, cotizacion_fecha? }
 *    (una fila por modelo; `compra` es la foto de la compra — lonas, envío,
 *    prorrateo — para poder auditarla y recargarla)
 *
 * El resultado de cada entrada se RECALCULA acá con la misma función que
 * usa la pantalla (lib/rentabilidad.ts). No toca products.
 */
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);

  const crudos: unknown[] = Array.isArray(body?.items)
    ? body.items
    : [{ nombre: body?.nombre, product_id: body?.product_id, entrada: body?.entrada }];
  if (crudos.length === 0 || crudos.length > 30) {
    return NextResponse.json({ error: 'Cantidad de modelos inválida' }, { status: 400 });
  }

  let compra: Record<string, unknown> | null = null;
  if (body?.compra !== undefined && body?.compra !== null) {
    if (typeof body.compra !== 'object' || JSON.stringify(body.compra).length > 60000) {
      return NextResponse.json({ error: 'Datos de la compra inválidos' }, { status: 400 });
    }
    compra = body.compra as Record<string, unknown>;
  }

  const notas = typeof body?.notas === 'string' && body.notas.trim() ? body.notas.trim().slice(0, 500) : null;
  const origen = body?.cotizacion_origen === 'manual' ? 'manual' : 'blue';
  const fecha = typeof body?.cotizacion_fecha === 'string' && !Number.isNaN(Date.parse(body.cotizacion_fecha))
    ? new Date(body.cotizacion_fecha).toISOString()
    : null;

  const filas = [];
  for (const c of crudos) {
    const item = c as Record<string, unknown>;
    const nombre = typeof item?.nombre === 'string' ? item.nombre.trim().slice(0, 120) : '';
    if (!nombre) return NextResponse.json({ error: 'Poné un nombre o modelo para guardar la simulación' }, { status: 400 });

    const entrada = normalizarEntrada(item?.entrada);
    if (!entrada) return NextResponse.json({ error: 'Datos de la simulación inválidos' }, { status: 400 });

    const resultado = calcularRentabilidad(entrada);
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 400 });

    const productId = typeof item?.product_id === 'string' && UUID_RE.test(item.product_id) ? item.product_id : null;
    const usaDolar = entrada.cotizacionUsd !== null;

    filas.push({
      nombre,
      product_id: productId,
      precio_docena: entrada.precioDocena,
      docenas_compra: entrada.docenasCompra,
      cotizacion_usd: usaDolar ? entrada.cotizacionUsd : null,
      cotizacion_origen: usaDolar ? origen : null,
      cotizacion_fecha: usaDolar && origen === 'blue' ? fecha : null,
      costo_real_docena: resultado.costoRealDocena,
      ganancia_docena: resultado.gananciaDocena,
      margen_pct: resultado.margenPct,
      markup_pct: resultado.markupPct,
      veredicto: resultado.veredicto,
      notas,
      inputs: entrada,
      resultados: resultado,
      compra,
      created_by: adminUser.id,
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from('cost_simulations').insert(filas).select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** DELETE /api/admin/costos/simulaciones?id=... — borra una simulación del historial. */
export async function DELETE(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'Falta un id válido' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('cost_simulations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
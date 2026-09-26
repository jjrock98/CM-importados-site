import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  calcularGastosFijosPorDocena,
  calcularCostoTotalDocena,
  simularMargen,
  MARGENES_DEFAULT,
} from '@/lib/costos';
import type { ProductCost, CostSetting, CostPeriodConfig } from '@/types';

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

// Mismo criterio que export-orders/route.ts: si el valor puede traer
// coma, punto y coma o comillas, se envuelve entre comillas dobles y
// se escapan las comillas internas duplicándolas (regla estándar CSV).
function csvCell(value: string | number): string {
  const str = String(value);
  return /[",;\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * GET /api/admin/costos/export/csv?periodo=YYYY-MM&margenes=30,50,100
 *
 * Alternativa liviana al Excel: mismo reporte, mismo cálculo
 * (lib/costos.ts), pero como CSV plano — sin la dependencia nueva
 * `xlsx` y sin fórmulas vivas (los valores quedan fijos al momento de
 * exportar). Abre bien en Excel/Sheets, igual que /export-orders.
 */
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const periodo = req.nextUrl.searchParams.get('periodo') ?? periodoActual();
  const margenesParam = req.nextUrl.searchParams.get('margenes');
  const margenes = margenesParam
    ? margenesParam.split(',').map(Number).filter((n) => !Number.isNaN(n))
    : MARGENES_DEFAULT;

  const admin = createAdminClient();
  const [{ data: products, error }, { data: costs }, { data: settings }, { data: periodConfig }] =
    await Promise.all([
      admin.from('products').select('id, nombre, precio_docena').eq('activo', true).order('nombre'),
      admin.from('product_costs').select('*'),
      admin.from('cost_settings').select('*').eq('activo', true),
      admin.from('cost_period_config').select('*').eq('periodo', periodo).maybeSingle(),
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const costsByProduct = new Map<string, ProductCost>();
  for (const c of (costs ?? []) as ProductCost[]) costsByProduct.set(c.product_id, c);

  const totalGastosFijosMensuales = ((settings ?? []) as CostSetting[]).reduce(
    (acc, s) => acc + Number(s.monto_mensual), 0
  );
  const docenasEstimadas = (periodConfig as CostPeriodConfig | null)?.docenas_estimadas ?? 0;
  const gastosFijosPorDocena = calcularGastosFijosPorDocena(totalGastosFijosMensuales, docenasEstimadas);

  const headers = [
    'Producto', 'Compra/Doc', 'Transporte/Doc', 'Empaque/Doc',
    'Fijos prorrateados/Doc', 'Costo Total/Doc', 'Precio actual catálogo',
    ...margenes.flatMap((m) => [`Sugerido ${m}%`, `Recomendado ${m}%`]),
  ];

  const lines = [headers.map(csvCell).join(',')];

  for (const p of products ?? []) {
    const c = costsByProduct.get(p.id);
    const row = calcularCostoTotalDocena(
      {
        product_id: p.id,
        nombre: p.nombre,
        precio_docena_actual: Number(p.precio_docena),
        costo_compra_docena: Number(c?.costo_compra_docena ?? 0),
        transporte_docena: Number(c?.transporte_docena ?? 0),
        empaque_docena: Number(c?.empaque_docena ?? 0),
        otros_docena: Number(c?.otros_docena ?? 0),
      },
      gastosFijosPorDocena
    );
    const sugeridos = margenes.flatMap((m) => {
      const sim = simularMargen(row.costo_total_docena, m);
      return [sim.precio_sugerido_docena, sim.precio_sugerido_docena_recomendado];
    });
    lines.push([
      row.nombre, row.costo_compra_docena, row.transporte_docena, row.empaque_docena,
      row.gastos_fijos_prorrateados_docena, row.costo_total_docena, row.precio_docena_actual,
      ...sugeridos,
    ].map(csvCell).join(','));
  }

  // ── Detalle de gastos fijos del período ──────────────────────────────
  // Bloque aparte, debajo de la tabla de productos, para que quede
  // trazable de dónde sale "Fijos prorrateados/Doc": qué gastos están
  // activos, cuál es fijo (alquiler, despensas) y cuál se paga por día
  // trabajado (empleado), con su desglose de días × pago.
  lines.push('');
  lines.push(csvCell('Gastos fijos del período (activos)'));
  lines.push(['Nombre', 'Tipo', 'Días/mes', 'Pago/día', 'Monto mensual'].map(csvCell).join(','));
  for (const s of (settings ?? []) as CostSetting[]) {
    lines.push([
      s.nombre,
      s.tipo === 'por_dia' ? 'Por día trabajado' : 'Monto fijo',
      s.tipo === 'por_dia' ? (s.dias_mes ?? '') : '',
      s.tipo === 'por_dia' ? (s.pago_por_dia ?? '') : '',
      s.monto_mensual,
    ].map(csvCell).join(','));
  }
  lines.push('');
  lines.push(['Total gastos fijos activos', '', '', '', totalGastosFijosMensuales].map(csvCell).join(','));
  lines.push(['Docenas estimadas del período', '', '', '', docenasEstimadas].map(csvCell).join(','));
  lines.push(['Gastos fijos prorrateados por docena', '', '', '', Math.round(gastosFijosPorDocena * 100) / 100].map(csvCell).join(','));

  // BOM para que Excel en Windows detecte UTF-8 y no rompa los acentos/€/$.
  const csv = '\uFEFF' + lines.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="costos-por-docena-${periodo}.csv"`,
    },
  });
}
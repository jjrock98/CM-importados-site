import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import * as XLSX from 'xlsx';
import {
  calcularGastosFijosPorDocena,
  calcularCostoTotalDocena,
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

/**
 * GET /api/admin/costos/export/excel?periodo=YYYY-MM&margenes=30,50,100
 *
 * Exporta el reporte de Costos por Docena a un .xlsx real (no CSV).
 * A diferencia del PDF, acá el % de margen de cada columna se escribe
 * como una FÓRMULA de Excel (costo_total_docena * (1 + margen)), para
 * que el admin pueda tocar el % directamente en la planilla y ver el
 * precio sugerido recalcularse ahí mismo, sin volver a generar el
 * archivo. Es la misma fórmula de lib/costos.ts, solo expresada en
 * sintaxis de Excel — nunca escribe nada de vuelta al catálogo.
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

  const rows = (products ?? []).map((p) => {
    const c = costsByProduct.get(p.id);
    return calcularCostoTotalDocena(
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
  });

  // ── Encabezados ─────────────────────────────────────────────────────
  const headers = [
    'Producto', 'Compra/Doc', 'Transporte/Doc', 'Empaque/Doc',
    'Fijos prorrateados/Doc', 'Costo Total/Doc', 'Precio actual catálogo',
    ...margenes.map((m) => `Sugerido ${m}%`),
  ];

  const aoa: (string | number)[][] = [headers];

  rows.forEach((row) => {
    aoa.push([
      row.nombre,
      row.costo_compra_docena,
      row.transporte_docena,
      row.empaque_docena,
      row.gastos_fijos_prorrateados_docena,
      row.costo_total_docena,
      row.precio_docena_actual,
      // Valor calculado como respaldo; se reemplaza por una fórmula viva
      // justo abajo, celda por celda (aoa_to_sheet no soporta fórmulas
      // directamente en el array de entrada).
      ...margenes.map((m) => Math.round(row.costo_total_docena * (1 + m / 100) * 100) / 100),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 32 }, { wch: 13 }, { wch: 14 }, { wch: 12 },
    { wch: 20 }, { wch: 14 }, { wch: 18 },
    ...margenes.map(() => ({ wch: 14 })),
  ];

  // Fórmula viva por celda: si el admin cambia cualquier costo de la
  // fila, el precio sugerido se recalcula solo en Excel, sin necesidad
  // de volver a exportar. Costo Total/Doc siempre cae en la columna F.
  for (let idx = 0; idx < rows.length; idx++) {
    const excelRow = idx + 2; // fila 1 = encabezados, las planillas son 1-based
    const costoTotalCell = `F${excelRow}`;
    margenes.forEach((m, i) => {
      const colLetter = XLSX.utils.encode_col(7 + i); // las columnas de margen arrancan en H (índice 7)
      const cellRef = `${colLetter}${excelRow}`;
      const cell = ws[cellRef];
      if (cell) cell.f = `${costoTotalCell}*(1+${m}/100)`;
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Costos por Docena');

  // Segunda hoja: parámetros usados, para que quede trazable de dónde
  // sale el "Fijos prorrateados/Doc" de la primera hoja.
  const wsParams = XLSX.utils.aoa_to_sheet([
    ['Parámetro', 'Valor'],
    ['Período', periodo],
    ['Total gastos fijos mensuales activos', totalGastosFijosMensuales],
    ['Docenas estimadas del período', docenasEstimadas],
    ['Gastos fijos prorrateados por docena', gastosFijosPorDocena],
    [],
    ['Nota', 'Herramienta de simulación interna. No modifica los precios publicados en el catálogo.'],
  ]);
  wsParams['!cols'] = [{ wch: 36 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsParams, 'Parámetros');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="costos-por-docena-${periodo}.xlsx"`,
    },
  });
}
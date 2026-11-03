import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/verifyAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
import {
  calcularGastosFijosPorDocena,
  calcularCostoTotalDocena,
  MARGENES_DEFAULT,
} from '@/lib/costos';
import type { ProductCost, CostSetting, CostPeriodConfig } from '@/types';

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
    ...margenes.flatMap((m) => [`Sugerido ${m}%`, `Recomendado ${m}%`]),
  ];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Costos por Docena');
  ws.columns = [
    { width: 32 }, { width: 13 }, { width: 14 }, { width: 12 },
    { width: 20 }, { width: 14 }, { width: 18 },
    ...margenes.flatMap(() => [{ width: 14 }, { width: 14 }]),
  ];
  ws.addRow(headers);

  rows.forEach((row) => {
    const excelRow = ws.addRow([
      row.nombre,
      row.costo_compra_docena,
      row.transporte_docena,
      row.empaque_docena,
      row.gastos_fijos_prorrateados_docena,
      row.costo_total_docena,
      row.precio_docena_actual,
    ]);

    // Fórmula viva por celda: si el admin cambia cualquier costo de la
    // fila, el precio sugerido y el recomendado se recalculan solos en
    // Excel, sin necesidad de volver a exportar. Costo Total/Doc siempre
    // cae en la columna F. Cada margen ocupa dos columnas consecutivas:
    // la del precio sugerido exacto y, a su lado, CEILING(...,1) redondeado
    // hacia arriba y sin decimales (la recomendación). El `result` es el
    // valor ya calculado, para que se vea igual en visores que no
    // recalculan fórmulas (vista previa del celular, por ejemplo).
    margenes.forEach((m, i) => {
      const sugerido = Math.round(row.costo_total_docena * (1 + m / 100) * 100) / 100;
      const celdaSugerido = excelRow.getCell(8 + i * 2);      // los márgenes arrancan en la columna H (8)
      const celdaRecomendado = excelRow.getCell(9 + i * 2);
      celdaSugerido.value = { formula: `F${excelRow.number}*(1+${m}/100)`, result: sugerido };
      celdaRecomendado.value = { formula: `CEILING(${celdaSugerido.address},1)`, result: Math.ceil(sugerido) };
    });
  });

  // Segunda hoja: parámetros usados + detalle de cada gasto fijo activo
  // (nombre, si es monto fijo o por día trabajado, y su desglose), para
  // que quede trazable de dónde sale el "Fijos prorrateados/Doc" de la
  // primera hoja.
  const settingsList = (settings ?? []) as CostSetting[];
  const wsParams = wb.addWorksheet('Parámetros');
  wsParams.columns = [{ width: 32 }, { width: 22 }, { width: 12 }, { width: 12 }, { width: 16 }];
  wsParams.addRows([
    ['Parámetro', 'Valor'],
    ['Período', periodo],
    ['Total gastos fijos mensuales activos', totalGastosFijosMensuales],
    ['Docenas estimadas del período', docenasEstimadas],
    ['Gastos fijos prorrateados por docena', gastosFijosPorDocena],
    [],
    ['Detalle de gastos fijos activos'],
    ['Nombre', 'Tipo', 'Días/mes', 'Pago/día', 'Monto mensual'],
    ...settingsList.map((s) => [
      s.nombre,
      s.tipo === 'por_dia' ? 'Por día trabajado' : 'Monto fijo',
      s.tipo === 'por_dia' ? (s.dias_mes ?? null) : null,
      s.tipo === 'por_dia' ? (s.pago_por_dia ?? null) : null,
      s.monto_mensual,
    ]),
    [],
    ['Nota', 'Herramienta de simulación interna. No modifica los precios publicados en el catálogo.'],
  ]);

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="costos-por-docena-${periodo}.xlsx"`,
    },
  });
}
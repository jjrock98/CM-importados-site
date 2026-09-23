import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calcularGastosFijosPorDocena, calcularCostoTotalDocena } from '@/lib/costos';
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
 * GET /api/admin/costos?periodo=YYYY-MM
 *
 * Devuelve el reporte completo de Costos por Docena: un renglón por
 * producto activo, con su costo total por docena ya calculado
 * (compra + transporte + empaque + otros + gastos fijos prorrateados
 * del período). Es de solo lectura — no toca products.precio_docena.
 *
 * Productos sin costos cargados todavía aparecen igual, con
 * costo_compra_docena/transporte_docena/empaque_docena/otros_docena
 * en 0, para que el admin vea de un vistazo a quién le falta cargar
 * el dato (en vez de que desaparezcan del reporte).
 */
export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const periodo = req.nextUrl.searchParams.get('periodo') ?? periodoActual();
  const admin = createAdminClient();

  const [{ data: products, error: errProducts }, { data: costs }, { data: settings }, { data: periodConfig }] =
    await Promise.all([
      admin.from('products').select('id, nombre, precio_docena, activo').eq('activo', true).order('nombre'),
      admin.from('product_costs').select('*'),
      admin.from('cost_settings').select('*').eq('activo', true),
      admin.from('cost_period_config').select('*').eq('periodo', periodo).maybeSingle(),
    ]);

  if (errProducts) return NextResponse.json({ error: errProducts.message }, { status: 500 });

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

  return NextResponse.json({
    periodo,
    total_gastos_fijos_mensuales: totalGastosFijosMensuales,
    docenas_estimadas: docenasEstimadas,
    gastos_fijos_por_docena: Math.round(gastosFijosPorDocena * 100) / 100,
    rows,
  });
}
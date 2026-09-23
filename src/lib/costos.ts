/**
 * Lógica de cálculo del Módulo de Análisis y Reportes de Costos por Docena.
 *
 * TODO acá se calcula estrictamente POR DOCENA (bulto), nunca por unidad
 * individual — es un requerimiento de negocio explícito. Esta es la ÚNICA
 * fuente de verdad para la fórmula: la usan por igual la tabla del admin
 * (cálculo instantáneo en el cliente al mover el margen), el export a PDF
 * y el export a Excel, para que los tres nunca puedan desincronizarse.
 *
 * Es una herramienta de SIMULACIÓN interna: nada de lo que hay acá escribe
 * sobre products.precio_docena / precio_media_docena. Aplicar un precio
 * sugerido al catálogo es siempre una acción manual y explícita del admin
 * (ver PUT /api/admin/products), nunca un efecto secundario de este cálculo.
 */

export interface ProductCostInput {
  product_id: string;
  nombre: string;
  precio_docena_actual: number; // precio de venta actual en el catálogo (solo comparativo)
  costo_compra_docena: number;
  transporte_docena: number;
  empaque_docena: number;
  otros_docena: number;
}

export interface CostReportRow extends ProductCostInput {
  gastos_fijos_prorrateados_docena: number;
  costo_total_docena: number;
  costo_total_unidad: number; // informativo — costo_total_docena / 12
}

export interface MarginSimulation {
  margen_pct: number;
  precio_sugerido_docena: number;
  precio_sugerido_unidad: number;
  ganancia_docena: number;
}

/**
 * Prorratea los gastos fijos mensuales activos entre las docenas
 * estimadas del período. Si no hay docenas estimadas cargadas (0 o
 * ausente), devuelve 0 en vez de dividir por cero — el reporte sigue
 * siendo válido, solo sin el componente de gastos fijos hasta que el
 * admin cargue una estimación.
 */
export function calcularGastosFijosPorDocena(
  totalGastosFijosMensuales: number,
  docenasEstimadasPeriodo: number
): number {
  if (!docenasEstimadasPeriodo || docenasEstimadasPeriodo <= 0) return 0;
  return totalGastosFijosMensuales / docenasEstimadasPeriodo;
}

/**
 * Arma la fila de reporte de un producto: suma todos los componentes
 * de costo por docena (compra + transporte + empaque + otros +
 * prorrateo de fijos). Es una suma simple y explícita a propósito —
 * cualquier componente nuevo que se agregue en el futuro (ej. un
 * "costo financiero por docena") se suma acá y en ningún otro lugar.
 */
export function calcularCostoTotalDocena(
  input: ProductCostInput,
  gastosFijosPorDocena: number
): CostReportRow {
  const costo_total_docena =
    input.costo_compra_docena +
    input.transporte_docena +
    input.empaque_docena +
    input.otros_docena +
    gastosFijosPorDocena;

  return {
    ...input,
    gastos_fijos_prorrateados_docena: round2(gastosFijosPorDocena),
    costo_total_docena: round2(costo_total_docena),
    // El costo por unidad es puramente informativo (para comparar contra
    // precio_unitario de venta minorista si el producto lo tiene) — la
    // base de cálculo real sigue siendo la docena.
    costo_total_unidad: round2(costo_total_docena / 12),
  };
}

/**
 * Simula el precio de venta sugerido por docena para un % de margen
 * dado, a partir del costo total ya calculado. margen_pct es un
 * porcentaje sobre el costo (ej. 50 → costo * 1.5), no sobre el precio
 * de venta — es la convención más habitual en mayorista/reventa.
 */
export function simularMargen(costoTotalDocena: number, margenPct: number): MarginSimulation {
  const precio_sugerido_docena = costoTotalDocena * (1 + margenPct / 100);
  return {
    margen_pct: margenPct,
    precio_sugerido_docena: round2(precio_sugerido_docena),
    precio_sugerido_unidad: round2(precio_sugerido_docena / 12),
    ganancia_docena: round2(precio_sugerido_docena - costoTotalDocena),
  };
}

/** Márgenes por defecto que pide el simulador (30%, 50%, 100%). Ver requerimiento 2. */
export const MARGENES_DEFAULT = [30, 50, 100];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
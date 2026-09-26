/**
 * Calculadora de rentabilidad por DOCENA (herramienta interna de admin).
 *
 * Función pura: no toca la base ni el catálogo. Todo el resultado se
 * expresa en ARS y por docena. Si algún costo está en USD se convierte
 * con la cotización que se le pase (dólar blue "venta" o manual) — nunca
 * se inventa una cotización: si falta y hace falta, devuelve error.
 *
 * Definiciones (las mismas que se muestran en pantalla):
 *  - Costo directo/docena   = (mercadería + transporte + envío + otros) / docenas de la compra
 *  - Gastos variables/docena = comisión % × precio + monto fijo por docena
 *  - Gastos fijos/docena     = gastos fijos mensuales / docenas estimadas del mes
 *  - Imprevistos/docena      = imprevistos del lote (opcional) / docenas de la compra
 *  - Costo real/docena       = directo + variables + fijos asignados + imprevistos
 *  - Ganancia                = precio − costo real
 *  - Margen                  = ganancia / precio × 100
 *  - Markup                  = ganancia / costo real × 100
 *  - Punto de equilibrio     = gastos fijos mensuales / (precio − directo − variables − imprevistos)
 */

export type Moneda = 'ARS' | 'USD';

export interface LineaCosto {
  concepto: string;
  monto: number;
  moneda: Moneda;
}

export interface EntradaRentabilidad {
  precioDocena: number;              // precio de venta por docena, en ARS
  docenasCompra: number;             // docenas REALES de la compra
  costosDirectos: LineaCosto[];      // mercadería, transporte, envío, otros
  cotizacionUsd: number | null;      // ARS por USD (campo "venta" o manual)
  gastosFijosMensuales: number;      // ARS
  docenasEstimadasMes: number;       // divisor del prorrateo de fijos
  comisionPct: number;               // % del precio (medios de pago, etc.)
  variableFijoDocena: number;        // ARS por docena (embalaje de venta, etc.)
  margenObjetivoPct: number;         // para el veredicto y el precio sugerido
  imprevistos?: { monto: number; moneda: Moneda }; // gasto sorpresivo opcional del lote
}

export interface LineaConvertida extends LineaCosto {
  montoArs: number;
}

export type Veredicto = 'optimo' | 'bajo_objetivo' | 'perdida';

export interface ResultadoRentabilidad {
  ok: true;
  lineas: LineaConvertida[];
  totalDirectoArs: number;
  directoDocena: number;
  comisionDocena: number;
  variableFijoDocena: number;
  variablesDocena: number;
  fijoDocena: number;
  imprevistosDocena: number;
  costoRealDocena: number;
  gananciaDocena: number;
  margenPct: number;
  markupPct: number;
  contribucionDocena: number;
  puntoEquilibrioDocenas: number | null; // null = con este precio nunca se cubren los fijos
  precioMinimo: number | null;           // precio con ganancia 0
  precioObjetivo: number | null;         // precio que da el margen objetivo
  precioRecomendado: number | null;      // precioObjetivo redondeado hacia arriba (sin decimales), para evaluar
  veredicto: Veredicto;
  avisos: string[];
}

export interface ErrorRentabilidad {
  ok: false;
  error: string;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Texto del aviso cuando hay gastos fijos pero no hay docenas estimadas
 * del mes para prorratearlos (fijoDocena queda en 0, no en error). Se
 * exporta como constante para que la UI pueda identificarlo sin comparar
 * texto libre — por ejemplo, para no repetirlo una vez por modelo en una
 * compra multimodelo, donde el dato es el mismo para todos.
 */
export const AVISO_SIN_DOCENAS_ESTIMADAS =
  'Hay gastos fijos cargados (alquiler, despensas, etc.) pero "Docenas estimadas a vender en el mes" está en 0, así que no se pudieron prorratear: completá ese campo en la sección de Gastos.';

const finito = (n: number) => (Number.isFinite(n) ? n : 0);

export function calcularRentabilidad(
  e: EntradaRentabilidad
): ResultadoRentabilidad | ErrorRentabilidad {
  if (!(e.docenasCompra > 0)) {
    return { ok: false, error: 'Ingresá la cantidad de docenas de la compra (mayor a 0).' };
  }

  const imp = e.imprevistos;
  const hayUsd =
    e.costosDirectos.some((l) => l.moneda === 'USD' && l.monto > 0) ||
    (!!imp && imp.moneda === 'USD' && imp.monto > 0);
  if (hayUsd && !(e.cotizacionUsd && e.cotizacionUsd > 0)) {
    return { ok: false, error: 'Hay costos en USD pero no hay cotización del dólar. Ingresá una manualmente.' };
  }

  const cot = e.cotizacionUsd ?? 0;
  const lineas: LineaConvertida[] = e.costosDirectos.map((l) => ({
    ...l,
    montoArs: round2(l.moneda === 'USD' ? l.monto * cot : l.monto),
  }));

  const totalDirectoArs = round2(lineas.reduce((acc, l) => acc + l.montoArs, 0));
  const directoDocena = totalDirectoArs / e.docenasCompra;

  const comisionDocena = e.precioDocena * (e.comisionPct / 100);
  const variablesDocena = comisionDocena + e.variableFijoDocena;

  const avisos: string[] = [];
  let fijoDocena = 0;
  if (e.gastosFijosMensuales > 0) {
    if (e.docenasEstimadasMes > 0) {
      fijoDocena = e.gastosFijosMensuales / e.docenasEstimadasMes;
    } else {
      avisos.push(AVISO_SIN_DOCENAS_ESTIMADAS);
    }
  }

  const imprevistosTotalArs = imp ? (imp.moneda === 'USD' ? imp.monto * cot : imp.monto) : 0;
  const imprevistosDocena = imprevistosTotalArs / e.docenasCompra;

  const costoRealDocena = directoDocena + variablesDocena + fijoDocena + imprevistosDocena;
  const gananciaDocena = e.precioDocena - costoRealDocena;
  const margenPct = e.precioDocena > 0 ? (gananciaDocena / e.precioDocena) * 100 : 0;
  const markupPct = costoRealDocena > 0 ? (gananciaDocena / costoRealDocena) * 100 : 0;

  const contribucionDocena = e.precioDocena - directoDocena - variablesDocena - imprevistosDocena;
  let puntoEquilibrioDocenas: number | null = null;
  if (e.gastosFijosMensuales <= 0) {
    puntoEquilibrioDocenas = 0;
  } else if (contribucionDocena > 0) {
    puntoEquilibrioDocenas = e.gastosFijosMensuales / contribucionDocena;
  }

  // Precio con el que la ganancia es 0 / con el que se logra el margen objetivo.
  // Se despeja P de: P − (base + pct·P) = margen·P
  const base = directoDocena + e.variableFijoDocena + fijoDocena + imprevistosDocena;
  const pct = e.comisionPct / 100;
  const denMin = 1 - pct;
  const denObj = 1 - pct - e.margenObjetivoPct / 100;
  const precioMinimo = denMin > 0 ? base / denMin : null;
  const precioObjetivo = denObj > 0 ? base / denObj : null;
  // El precio recomendado es el precio objetivo, pero siempre redondeado
  // hacia arriba (nunca hacia abajo) y sin decimales — se calcula sobre el
  // valor crudo (antes de round2) para que el redondeo hacia arriba sea
  // exacto y no quede afectado por un redondeo previo a 2 decimales. Es
  // solo una sugerencia: el admin decide si le sirve o no.
  const precioRecomendado = precioObjetivo === null ? null : Math.ceil(precioObjetivo);

  let veredicto: Veredicto;
  if (gananciaDocena < 0) veredicto = 'perdida';
  else if (margenPct < e.margenObjetivoPct) veredicto = 'bajo_objetivo';
  else veredicto = 'optimo';

  if (e.precioDocena > directoDocena && gananciaDocena < 0) {
    avisos.push('El precio cubre la mercadería y el transporte, pero no alcanza para los gastos.');
  }
  if (puntoEquilibrioDocenas === null) {
    avisos.push('Con este precio no queda contribución por docena: los gastos fijos nunca se cubren.');
  }

  return {
    ok: true,
    lineas,
    totalDirectoArs,
    directoDocena: round2(finito(directoDocena)),
    comisionDocena: round2(finito(comisionDocena)),
    variableFijoDocena: round2(e.variableFijoDocena),
    variablesDocena: round2(finito(variablesDocena)),
    fijoDocena: round2(finito(fijoDocena)),
    imprevistosDocena: round2(finito(imprevistosDocena)),
    costoRealDocena: round2(finito(costoRealDocena)),
    gananciaDocena: round2(finito(gananciaDocena)),
    margenPct: round2(finito(margenPct)),
    markupPct: round2(finito(markupPct)),
    contribucionDocena: round2(finito(contribucionDocena)),
    puntoEquilibrioDocenas: puntoEquilibrioDocenas === null ? null : round2(puntoEquilibrioDocenas),
    precioMinimo: precioMinimo === null ? null : round2(precioMinimo),
    precioObjetivo: precioObjetivo === null ? null : round2(precioObjetivo),
    precioRecomendado,
    veredicto,
    avisos,
  };
}
/**
 * Compra multimodelo con lonas, envío por lona y prorrateo (admin).
 *
 * Función pura. Una compra puede traer varios modelos; los costos
 * globales (lonas, envío por lona, recargos) se reparten entre los
 * modelos y dan el costo directo real por docena de cada uno.
 *
 * El total de docenas de la compra se declara primero y después se
 * detallan las docenas de cada modelo; la suma de los modelos debe
 * coincidir con ese total (si no, se informa la diferencia).
 *
 * Reglas (las mismas que se muestran en el desglose de pantalla):
 *  - Lonas usadas       = docenas totales / docenas por lona (puede ser fraccionaria)
 *  - Costo de lonas     = lonas usadas × costo de la lona (redondeo hacia arriba opcional)
 *  - Costo de envío     = bultos × tarifa por lona (redondeo hacia arriba opcional)
 *  - Recargo %          = % SOLO sobre el total de la mercadería (las docenas),
 *                         antes de lonas y envío. Es opcional: se usa en compras
 *                         a distancia y varía por proveedor (0 = sin recargo).
 *                         Cada modelo carga el % sobre su propia mercadería.
 *  - Recargo fijo       = monto fijo global (opcional)
 *  - Prorrateo          = lonas, envío y recargo fijo, proporcional a las DOCENAS de cada modelo
 *  - Costo directo/doc  = (mercadería + recargo % + parte de lonas + envío + recargo fijo) / docenas del modelo
 * Los imprevistos NO son costo directo: se prorratean aparte y solo
 * entran en el costo real.
 */
import { round2, type EntradaRentabilidad, type Moneda } from './rentabilidad';

export interface ConfigLonas {
  docenasTotales: number; // total de docenas declarado de la compra (0 = no declarado)
  docenasPorLona: number;
  costoLona: number;
  monedaLona: Moneda;
  redondearLonas: boolean;
  costoEnvioLona: number;
  monedaEnvio: Moneda;
  redondearEnvio: boolean;
  recargoPct: number;
  recargoFijo: number;
  monedaRecargoFijo: Moneda;
  imprevistos: number;
  monedaImprevistos: Moneda;
}

export interface ModeloCompra {
  modelo: string;
  docenas: number;
  precioDocena: number; // costo de compra por docena, en `moneda`
  moneda: Moneda;
  precioVenta: number;  // precio de venta pretendido por docena, ARS (0 = sin analizar)
}

export interface ModeloCalculado {
  modelo: string;
  docenas: number;
  precioDocenaArs: number;
  mercaderiaArs: number;
  lonasArs: number;
  envioArs: number;
  recargosArs: number;
  directoTotalArs: number;
  directoDocena: number;
  imprevistosArs: number;
  precioVenta: number;
}

export interface ResultadoCompra {
  ok: true;
  docenasTotales: number;
  docenasDeclaradas: number | null; // total que se ingresó antes de detallar los modelos
  diferenciaDocenas: number;        // declaradas − suma de modelos (0 = coincide)
  lonasUsadas: number;
  lonasCobradas: number;
  bultosEnvio: number;
  lonaUnitariaArs: number;
  envioUnitarioArs: number;
  costoLonasArs: number;
  costoEnvioArs: number;
  mercaderiaTotalArs: number;
  recargoPctArs: number;
  mercaderiaConRecargoArs: number;
  recargoFijoArs: number;
  recargosTotalArs: number;
  costoDirectoTotalArs: number;
  imprevistosArs: number;
  modelos: ModeloCalculado[];
}

export interface ErrorCompra {
  ok: false;
  error: string;
}

export function calcularCompraMultimodelo(
  cfg: ConfigLonas,
  modelosRaw: ModeloCompra[],
  cotizacionUsd: number | null
): ResultadoCompra | ErrorCompra {
  const modelos = modelosRaw.filter((m) => m.docenas > 0);
  if (modelos.length === 0) {
    return { ok: false, error: 'Cargá al menos un modelo con su cantidad de docenas.' };
  }

  const cot = cotizacionUsd && cotizacionUsd > 0 ? cotizacionUsd : 0;
  const usaUsd =
    modelos.some((m) => m.moneda === 'USD' && m.precioDocena > 0) ||
    (cfg.monedaLona === 'USD' && cfg.costoLona > 0) ||
    (cfg.monedaEnvio === 'USD' && cfg.costoEnvioLona > 0) ||
    (cfg.monedaRecargoFijo === 'USD' && cfg.recargoFijo > 0) ||
    (cfg.monedaImprevistos === 'USD' && cfg.imprevistos > 0);
  if (usaUsd && !cot) {
    return { ok: false, error: 'Hay costos en USD pero no hay cotización del dólar. Ingresá una manualmente.' };
  }
  const aArs = (monto: number, moneda: Moneda) => (moneda === 'USD' ? monto * cot : monto);

  const docenasTotales = modelos.reduce((a, m) => a + m.docenas, 0);
  const usaLonas = cfg.costoLona > 0 || cfg.costoEnvioLona > 0;
  if (usaLonas && !(cfg.docenasPorLona > 0)) {
    return { ok: false, error: 'Ingresá cuántas docenas entran en una lona (mayor a 0).' };
  }

  const lonasUsadas = cfg.docenasPorLona > 0 ? docenasTotales / cfg.docenasPorLona : 0;
  const lonasCobradas = cfg.redondearLonas ? Math.ceil(lonasUsadas - 1e-9) : lonasUsadas;
  const bultosEnvio = cfg.redondearEnvio ? Math.ceil(lonasUsadas - 1e-9) : lonasUsadas;

  const lonaUnitariaArs = aArs(cfg.costoLona, cfg.monedaLona);
  const envioUnitarioArs = aArs(cfg.costoEnvioLona, cfg.monedaEnvio);
  const costoLonasArs = lonasCobradas * lonaUnitariaArs;
  const costoEnvioArs = bultosEnvio * envioUnitarioArs;

  const lineas = modelos.map((m) => ({ m, precioArs: aArs(m.precioDocena, m.moneda) }));
  const mercaderiaTotalArs = lineas.reduce((a, l) => a + l.precioArs * l.m.docenas, 0);

  const recargoPctArs = mercaderiaTotalArs * (cfg.recargoPct / 100);
  const mercaderiaConRecargoArs = mercaderiaTotalArs + recargoPctArs;
  const recargoFijoArs = aArs(cfg.recargoFijo, cfg.monedaRecargoFijo);
  const recargosTotalArs = recargoPctArs + recargoFijoArs;
  const costoDirectoTotalArs = mercaderiaConRecargoArs + costoLonasArs + costoEnvioArs + recargoFijoArs;
  const imprevistosArs = aArs(cfg.imprevistos, cfg.monedaImprevistos);

  const calculados: ModeloCalculado[] = lineas.map(({ m, precioArs }) => {
    const parte = m.docenas / docenasTotales;
    const mercaderiaArs = precioArs * m.docenas;
    const lonasArs = costoLonasArs * parte;
    const envioArs = costoEnvioArs * parte;
    // El % recae sobre la mercadería propia del modelo; el fijo se reparte por docenas.
    const recargosArs = mercaderiaArs * (cfg.recargoPct / 100) + recargoFijoArs * parte;
    const directoTotalArs = mercaderiaArs + lonasArs + envioArs + recargosArs;
    return {
      modelo: m.modelo || 'Modelo',
      docenas: m.docenas,
      precioDocenaArs: round2(precioArs),
      mercaderiaArs: round2(mercaderiaArs),
      lonasArs: round2(lonasArs),
      envioArs: round2(envioArs),
      recargosArs: round2(recargosArs),
      directoTotalArs: round2(directoTotalArs),
      directoDocena: round2(directoTotalArs / m.docenas),
      imprevistosArs: round2(imprevistosArs * parte),
      precioVenta: m.precioVenta,
    };
  });

  return {
    ok: true,
    docenasTotales: round2(docenasTotales),
    docenasDeclaradas: cfg.docenasTotales > 0 ? round2(cfg.docenasTotales) : null,
    diferenciaDocenas: cfg.docenasTotales > 0 ? round2(cfg.docenasTotales - docenasTotales) : 0,
    lonasUsadas: round2(lonasUsadas),
    lonasCobradas: round2(lonasCobradas),
    bultosEnvio: round2(bultosEnvio),
    lonaUnitariaArs: round2(lonaUnitariaArs),
    envioUnitarioArs: round2(envioUnitarioArs),
    costoLonasArs: round2(costoLonasArs),
    costoEnvioArs: round2(costoEnvioArs),
    mercaderiaTotalArs: round2(mercaderiaTotalArs),
    recargoPctArs: round2(recargoPctArs),
    mercaderiaConRecargoArs: round2(mercaderiaConRecargoArs),
    recargoFijoArs: round2(recargoFijoArs),
    recargosTotalArs: round2(recargosTotalArs),
    costoDirectoTotalArs: round2(costoDirectoTotalArs),
    imprevistosArs: round2(imprevistosArs),
    modelos: calculados,
  };
}

/** Datos comunes (gastos, dólar, objetivo) que comparten todos los modelos de la compra. */
export type ComunesRentabilidad = Omit<
  EntradaRentabilidad,
  'precioDocena' | 'docenasCompra' | 'costosDirectos' | 'imprevistos'
>;

/**
 * Arma la entrada de calcularRentabilidad para un modelo de la compra:
 * su costo directo ya prorrateado entra como una sola línea en ARS.
 */
export function entradaParaModelo(m: ModeloCalculado, comunes: ComunesRentabilidad): EntradaRentabilidad {
  return {
    ...comunes,
    precioDocena: m.precioVenta,
    docenasCompra: m.docenas,
    costosDirectos: [{ concepto: 'Costo directo prorrateado', monto: m.directoTotalArs, moneda: 'ARS' }],
    imprevistos: { monto: m.imprevistosArs, moneda: 'ARS' },
  };
}
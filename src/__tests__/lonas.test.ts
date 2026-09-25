import { calcularCompraMultimodelo, entradaParaModelo, type ConfigLonas, type ModeloCompra } from '@/lib/lonas';
import { calcularRentabilidad } from '@/lib/rentabilidad';

const cfg: ConfigLonas = {
  docenasTotales: 36,
  docenasPorLona: 24,
  costoLona: 50000, monedaLona: 'ARS', redondearLonas: false,
  costoEnvioLona: 65000, monedaEnvio: 'ARS', redondearEnvio: true,
  recargoPct: 1.5,
  recargoFijo: 0, monedaRecargoFijo: 'ARS',
  imprevistos: 0, monedaImprevistos: 'ARS',
};
const modelos: ModeloCompra[] = [
  { modelo: 'A', docenas: 20, precioDocena: 4000, moneda: 'ARS', precioVenta: 12000 },
  { modelo: 'B', docenas: 16, precioDocena: 5000, moneda: 'ARS', precioVenta: 0 },
];

describe('calcularCompraMultimodelo', () => {
  it('36 docenas / 24 por lona = 1,5 lonas y el envío se cobra por 2 bultos', () => {
    const r = calcularCompraMultimodelo(cfg, modelos, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.lonasUsadas).toBe(1.5);
    expect(r.bultosEnvio).toBe(2);
    expect(r.costoEnvioArs).toBe(130000);
    expect(r.costoLonasArs).toBe(75000);
    expect(r.mercaderiaTotalArs).toBe(160000);
    // El 1,5 % es solo sobre la mercadería (160.000), antes de lonas y envío.
    expect(r.recargoPctArs).toBe(2400);
    expect(r.mercaderiaConRecargoArs).toBe(162400);
    expect(r.costoDirectoTotalArs).toBe(367400);
  });

  it('informa si las docenas por modelo no coinciden con el total declarado', () => {
    const ok = calcularCompraMultimodelo(cfg, modelos, null);
    if (!ok.ok) throw new Error(ok.error);
    expect(ok.docenasDeclaradas).toBe(36);
    expect(ok.diferenciaDocenas).toBe(0);

    const falta = calcularCompraMultimodelo({ ...cfg, docenasTotales: 40 }, modelos, null);
    if (!falta.ok) throw new Error(falta.error);
    expect(falta.diferenciaDocenas).toBe(4); // faltan 4 docenas por detallar

    const sinDeclarar = calcularCompraMultimodelo({ ...cfg, docenasTotales: 0 }, modelos, null);
    if (!sinDeclarar.ok) throw new Error(sinDeclarar.error);
    expect(sinDeclarar.docenasDeclaradas).toBeNull();
  });

  it('sin recargo (compra presencial) no se suma nada', () => {
    const r = calcularCompraMultimodelo({ ...cfg, recargoPct: 0 }, modelos, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.recargoPctArs).toBe(0);
    expect(r.costoDirectoTotalArs).toBe(365000);
  });

  it('el recargo % lo carga cada modelo sobre su propia mercadería', () => {
    const r = calcularCompraMultimodelo({ ...cfg, redondearEnvio: true }, modelos, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.modelos[0].recargosArs).toBe(1200); // 1,5 % de 80.000
    expect(r.modelos[1].recargosArs).toBe(1200);
  });

  it('el prorrateo reparte exactamente el total de la compra', () => {
    const r = calcularCompraMultimodelo(cfg, modelos, null);
    if (!r.ok) throw new Error(r.error);
    const suma = r.modelos.reduce((a, m) => a + m.directoTotalArs, 0);
    expect(suma).toBeCloseTo(r.costoDirectoTotalArs, 1);
    // A: 80.000 + 1.200 + 20/36 de (75.000 + 130.000) = 195.088,89 → / 20 docenas
    expect(r.modelos[0].directoDocena).toBeCloseTo(9754.44, 2);
    expect(r.modelos[1].directoDocena).toBeCloseTo(10769.44, 2); // B: (80.000 + 1.200 + 16/36 de 205.000) / 16
  });

  it('sin redondeo el envío se cobra fraccionado', () => {
    const r = calcularCompraMultimodelo({ ...cfg, redondearEnvio: false }, modelos, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.costoEnvioArs).toBe(97500);
  });

  it('convierte USD con la cotización y exige cotización si hay USD', () => {
    const usd = [{ modelo: 'A', docenas: 10, precioDocena: 10, moneda: 'USD' as const, precioVenta: 0 }];
    const sinCot = calcularCompraMultimodelo({ ...cfg, costoLona: 0, costoEnvioLona: 0, recargoPct: 0 }, usd, null);
    expect(sinCot.ok).toBe(false);
    const r = calcularCompraMultimodelo({ ...cfg, costoLona: 0, costoEnvioLona: 0, recargoPct: 0 }, usd, 1560);
    if (!r.ok) throw new Error(r.error);
    expect(r.modelos[0].directoDocena).toBe(15600);
  });

  it('error si no hay docenas por lona pero hay costo de lona', () => {
    expect(calcularCompraMultimodelo({ ...cfg, docenasPorLona: 0 }, modelos, null).ok).toBe(false);
  });

  it('el costo real incluye los imprevistos y se analiza por modelo', () => {
    const r = calcularCompraMultimodelo({ ...cfg, imprevistos: 3600 }, modelos, null);
    if (!r.ok) throw new Error(r.error);
    const a = r.modelos[0];
    const res = calcularRentabilidad(entradaParaModelo(a, {
      cotizacionUsd: null, gastosFijosMensuales: 0, docenasEstimadasMes: 0,
      comisionPct: 0, variableFijoDocena: 0, margenObjetivoPct: 30,
    }));
    if (!res.ok) throw new Error(res.error);
    expect(res.imprevistosDocena).toBe(100); // 3600 / 36 docenas
    expect(res.costoRealDocena).toBeCloseTo(a.directoDocena + 100, 1);
  });
});

describe('compra real anotada a mano (7 renglones, 36 docenas)', () => {
  const lista: ModeloCompra[] = [
    { modelo: 'Renglón 1', docenas: 5, precioDocena: 52000, moneda: 'ARS', precioVenta: 0 },
    { modelo: 'Renglón 2', docenas: 8, precioDocena: 47000, moneda: 'ARS', precioVenta: 0 },
    { modelo: 'Renglón 3', docenas: 5, precioDocena: 80000, moneda: 'ARS', precioVenta: 0 },
    { modelo: 'Renglón 4', docenas: 8, precioDocena: 40000, moneda: 'ARS', precioVenta: 0 },
    { modelo: 'Renglón 5', docenas: 7, precioDocena: 55000, moneda: 'ARS', precioVenta: 0 },
    { modelo: 'Renglón 6', docenas: 2, precioDocena: 50000, moneda: 'ARS', precioVenta: 0 },
    { modelo: 'Renglón 7', docenas: 1, precioDocena: 58000, moneda: 'ARS', precioVenta: 0 },
  ];
  const sinLonas: ConfigLonas = { ...cfg, docenasTotales: 36, costoLona: 0, costoEnvioLona: 0, recargoPct: 1.5 };

  it('suma 36 docenas y $1.899.000 de mercadería; con 1,5 % da $1.927.485', () => {
    const r = calcularCompraMultimodelo(sinLonas, lista, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.docenasTotales).toBe(36);
    expect(r.diferenciaDocenas).toBe(0);
    expect(r.modelos.map((m) => m.mercaderiaArs)).toEqual([260000, 376000, 400000, 320000, 385000, 100000, 58000]);
    expect(r.mercaderiaTotalArs).toBe(1899000);
    expect(r.recargoPctArs).toBe(28485);
    expect(r.mercaderiaConRecargoArs).toBe(1927485);
  });
});
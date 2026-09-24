import { calcularRentabilidad, type EntradaRentabilidad } from '@/lib/rentabilidad';

const base: EntradaRentabilidad = {
  precioDocena: 10000,
  docenasCompra: 30,
  costosDirectos: [
    { concepto: 'Mercadería', monto: 50000, moneda: 'ARS' },
    { concepto: 'Transporte', monto: 65000, moneda: 'ARS' },
  ],
  cotizacionUsd: null,
  gastosFijosMensuales: 700000,
  docenasEstimadasMes: 200,
  comisionPct: 0,
  variableFijoDocena: 0,
  margenObjetivoPct: 30,
};

describe('calcularRentabilidad', () => {
  it('reproduce el ejemplo del requerimiento (30 docenas)', () => {
    const r = calcularRentabilidad(base);
    if (!r.ok) throw new Error(r.error);
    expect(r.totalDirectoArs).toBe(115000);
    expect(r.directoDocena).toBe(3833.33);
    expect(r.fijoDocena).toBe(3500);
    expect(r.costoRealDocena).toBe(7333.33);
    expect(r.gananciaDocena).toBe(2666.67);
    expect(r.margenPct).toBe(26.67);
    expect(r.markupPct).toBe(36.36);
    expect(r.veredicto).toBe('bajo_objetivo'); // 26,67 % < objetivo 30 %
  });

  it('convierte USD con la cotización recibida (USD 100 × 1560 = 156000)', () => {
    const r = calcularRentabilidad({
      ...base,
      costosDirectos: [{ concepto: 'Mercadería', monto: 100, moneda: 'USD' }],
      cotizacionUsd: 1560,
      docenasCompra: 1,
      gastosFijosMensuales: 0,
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.lineas[0].montoArs).toBe(156000);
    expect(r.totalDirectoArs).toBe(156000);
  });

  it('no inventa cotización: error si hay USD y no hay dólar', () => {
    const r = calcularRentabilidad({
      ...base,
      costosDirectos: [{ concepto: 'Mercadería', monto: 100, moneda: 'USD' }],
      cotizacionUsd: null,
    });
    expect(r.ok).toBe(false);
  });

  it('error si las docenas son 0', () => {
    expect(calcularRentabilidad({ ...base, docenasCompra: 0 }).ok).toBe(false);
  });

  it('punto de equilibrio = fijos / (precio − directo − variables)', () => {
    const r = calcularRentabilidad(base);
    if (!r.ok) throw new Error(r.error);
    // contribución = 10000 − 3833,33 = 6166,67 → 700000 / 6166,67 ≈ 113,51
    expect(r.puntoEquilibrioDocenas).toBeCloseTo(113.51, 1);
  });

  it('el precio objetivo efectivamente da el margen objetivo', () => {
    const r = calcularRentabilidad({ ...base, comisionPct: 5, variableFijoDocena: 200 });
    if (!r.ok || r.precioObjetivo === null) throw new Error('sin precio objetivo');
    const r2 = calcularRentabilidad({ ...base, comisionPct: 5, variableFijoDocena: 200, precioDocena: r.precioObjetivo });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.margenPct).toBeCloseTo(30, 1);
  });

  it('el precio mínimo da ganancia 0 y detecta pérdida por debajo', () => {
    const r = calcularRentabilidad({ ...base, precioDocena: 6000 });
    if (!r.ok || r.precioMinimo === null) throw new Error('sin precio mínimo');
    expect(r.veredicto).toBe('perdida');
    const r0 = calcularRentabilidad({ ...base, precioDocena: r.precioMinimo });
    if (!r0.ok) throw new Error(r0.error);
    expect(Math.abs(r0.gananciaDocena)).toBeLessThan(0.02);
  });

  it('sin docenas estimadas no divide por cero y avisa', () => {
    const r = calcularRentabilidad({ ...base, docenasEstimadasMes: 0 });
    if (!r.ok) throw new Error(r.error);
    expect(r.fijoDocena).toBe(0);
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});
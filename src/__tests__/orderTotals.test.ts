import fs from 'fs';
import path from 'path';
import {
  aplicarDescuento,
  calcularMontosPedido,
  COSTO_ENVIO_FIJO,
} from '@/lib/orderTotals';

describe('aplicarDescuento', () => {
  it('sin descuento devuelve el subtotal tal cual', () => {
    expect(aplicarDescuento(240000, 0)).toBe(240000);
  });
  it('aplica el porcentaje y redondea al peso', () => {
    expect(aplicarDescuento(100000, 10)).toBe(90000);
    expect(aplicarDescuento(33333, 15)).toBe(28333); // 28333,05 → 28333
  });
});

describe('calcularMontosPedido', () => {
  it('el total sale del servidor: subtotal validado + envío fijo', () => {
    const r = calcularMontosPedido({ subtotalServidor: 240000, subtotalCliente: 240000 });
    expect(r).toEqual({ ok: true, montos: { subtotal: 240000, costo_envio: COSTO_ENVIO_FIJO, total: 240000 } });
  });

  it('aplica el descuento del cliente antes de comparar con el navegador', () => {
    const r = calcularMontosPedido({ subtotalServidor: 100000, descuentoPct: 10, subtotalCliente: 90000 });
    expect(r).toEqual({ ok: true, montos: { subtotal: 90000, costo_envio: 0, total: 90000 } });
  });

  it('rechaza si el navegador informa un subtotal más barato que el real (manipulación de precios)', () => {
    const r = calcularMontosPedido({ subtotalServidor: 240000, subtotalCliente: 1 });
    expect(r).toEqual({ ok: false, motivo: 'precios_cambiaron' });
  });

  it('rechaza si el navegador no aplicó el descuento que le corresponde (precios desactualizados)', () => {
    const r = calcularMontosPedido({ subtotalServidor: 100000, descuentoPct: 10, subtotalCliente: 100000 });
    expect(r.ok).toBe(false);
  });

  it('tolera una diferencia de hasta $1 por redondeo, y no más', () => {
    expect(calcularMontosPedido({ subtotalServidor: 1000, subtotalCliente: 1001 }).ok).toBe(true);
    expect(calcularMontosPedido({ subtotalServidor: 1000, subtotalCliente: 999 }).ok).toBe(true);
    expect(calcularMontosPedido({ subtotalServidor: 1000, subtotalCliente: 1002 }).ok).toBe(false);
  });

  it('el resultado usa siempre el subtotal del servidor, aunque el del navegador difiera por la tolerancia', () => {
    const r = calcularMontosPedido({ subtotalServidor: 1000, subtotalCliente: 1001 });
    expect(r.ok && r.montos.total).toBe(1000);
  });
});

/**
 * Guardia sobre la API de pedidos: el arreglo de seguridad consiste en que /api/orders
 * NUNCA lea `total` ni `costo_envio` del body y calcule los montos con el helper.
 * Este test falla si alguien reintroduce esa lectura (por ejemplo al editar la ruta).
 */
describe('/api/orders no confía en los montos del navegador', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/orders/route.ts'), 'utf8');

  it('usa calcularMontosPedido para definir los montos', () => {
    expect(source).toMatch(/calcularMontosPedido\(/);
  });

  it('no desestructura total ni costo_envio del body', () => {
    const lecturas = source.match(/const\s*\{[^}]*\}\s*=\s*body\s*;/g) ?? [];
    expect(lecturas.length).toBeGreaterThan(0);
    for (const l of lecturas) {
      expect(l).not.toMatch(/\btotal\b/);
      expect(l).not.toMatch(/\bcosto_envio\b/);
    }
  });

  it('no usa body.total ni body.costo_envio', () => {
    expect(source).not.toMatch(/body\.(total|costo_envio)\b/);
  });
});
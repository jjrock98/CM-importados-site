/**
 * Montos de un pedido: lógica PURA y compartida (sin dependencias de servidor),
 * para que el carrito, el mini carrito y la API calculen exactamente igual y para
 * poder probarla con tests automáticos.
 *
 * REGLA DE SEGURIDAD: los montos los define el SERVIDOR. Lo que mande el navegador
 * (subtotal, costo de envío, total) nunca se guarda tal cual: solo se usa el
 * subtotal del cliente para comprobar que vio los mismos precios que hoy tiene la
 * tienda. Si esa comprobación falla, el pedido se rechaza (HTTP 409).
 */

/** Hoy el envío es "a coordinar": no se cobra en el pedido. Si algún día se cobra, calcularlo en el servidor. */
export const COSTO_ENVIO_FIJO = 0;

/** Diferencia tolerada (en pesos) entre el subtotal del navegador y el del servidor, por redondeos. */
export const TOLERANCIA_SUBTOTAL = 1;

/** Aplica el descuento fijo del cliente (porcentaje) al subtotal, redondeando al peso. */
export function aplicarDescuento(subtotal: number, descuentoPct: number): number {
  return descuentoPct > 0 ? Math.round(subtotal * (1 - descuentoPct / 100)) : subtotal;
}

export interface MontosPedido {
  subtotal: number;
  costo_envio: number;
  total: number;
}

export type ResultadoMontos =
  | { ok: true; montos: MontosPedido }
  | { ok: false; motivo: 'precios_cambiaron' };

export function calcularMontosPedido(params: {
  /** Subtotal recalculado en el servidor con los precios actuales, SIN descuento. */
  subtotalServidor: number;
  /** Descuento fijo del cliente en %, si tiene cuenta mayorista activa. */
  descuentoPct?: number;
  /** Subtotal que informó el navegador (para detectar precios desactualizados o manipulados). */
  subtotalCliente: number;
}): ResultadoMontos {
  const subtotal = aplicarDescuento(params.subtotalServidor, params.descuentoPct ?? 0);

  if (Math.abs(subtotal - params.subtotalCliente) > TOLERANCIA_SUBTOTAL) {
    return { ok: false, motivo: 'precios_cambiaron' };
  }

  const costo_envio = COSTO_ENVIO_FIJO;
  return { ok: true, montos: { subtotal, costo_envio, total: subtotal + costo_envio } };
}
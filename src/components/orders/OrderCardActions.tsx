'use client';

import { ExternalLink } from 'lucide-react';

/**
 * Acciones interactivas dentro de la tarjeta de un pedido en /mis-pedidos.
 *
 * Por qué existe este componente aparte: toda la tarjeta del pedido es un
 * <Link> (para ir al detalle), y estos dos botones necesitan togglear
 * comportamiento propio (abrir el comprobante en una pestaña nueva, o
 * navegar a /subir-comprobante) SIN disparar la navegación del <Link>
 * padre — para eso hace falta `stopPropagation`, que requiere un manejador
 * de evento. Los manejadores de evento no pueden vivir en un Server
 * Component (la página /mis-pedidos no tiene 'use client'), por eso se
 * aislaron acá.
 */
export function VerComprobanteLink({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer'); }}
      className="flex items-center gap-1 text-brand-600 hover:underline cursor-pointer"
    >
      <ExternalLink size={11} /> Comprobante
    </button>
  );
}

export function SubirComprobanteLink({ orderId }: { orderId: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/subir-comprobante?orderId=${orderId}`; }}
      className="text-brand-600 hover:underline font-medium cursor-pointer"
    >
      Subir comprobante →
    </button>
  );
}
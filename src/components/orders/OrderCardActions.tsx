'use client';

import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

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
export function VerComprobanteLink({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      // El bucket de comprobantes es privado: no hay una URL fija guardada,
      // se pide una signed URL fresca (vence a los pocos minutos) cada vez.
      const res = await fetch(`/api/comprobante-url?orderId=${orderId}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'No se pudo abrir el comprobante');
        return;
      }
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('No se pudo abrir el comprobante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-brand-600 hover:underline cursor-pointer disabled:opacity-60"
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
      Comprobante
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
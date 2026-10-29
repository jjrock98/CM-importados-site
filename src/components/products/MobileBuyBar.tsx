'use client';
import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/utils';

/**
 * Barra fija inferior para celulares en la página de producto.
 *
 * Aparece mientras la zona de compra (#targetId) NO está a la vista —por
 * ejemplo, mientras el cliente mira fotos, descripción o reseñas— y se
 * oculta sola cuando esa zona entra en pantalla. El botón lleva suavemente
 * a las opciones de compra; no duplica la lógica de agregar al carrito
 * (talle, pack, cantidad), así que no puede quedar desincronizada.
 *
 * Solo se ve en pantallas chicas (lg:hidden). Deja libre el margen derecho
 * para la burbuja del chat, y sube el botón flotante de WhatsApp mientras
 * está visible (ver .buybar-lift en globals.css).
 */
export function MobileBuyBar({
  targetId,
  eyebrow,
  price,
  ctaLabel = 'Elegir pack',
}: {
  targetId: string;
  /** Texto chico sobre el precio (ej. "Docena (12)"). */
  eyebrow: string;
  /** Precio ya formateado (ej. "$ 240.000"). Va en su propia línea para que nunca se corte. */
  price: string;
  ctaLabel?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  useEffect(() => {
    document.body.classList.toggle('has-buy-bar', visible);
    return () => document.body.classList.remove('has-buy-bar');
  }, [visible]);

  const goToBuyBox = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(targetId)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  };

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden',
        'pl-4 pr-20 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-300',
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
      )}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[11px] text-muted">{eyebrow}</p>
          <p className="truncate text-base font-bold text-brand-600 dark:text-brand-300">{price}</p>
        </div>
        <button
          type="button"
          onClick={goToBuyBox}
          tabIndex={visible ? 0 : -1}
          className="btn-primary shrink-0 gap-2 px-4 py-2.5 text-sm"
        >
          <ShoppingCart size={16} /> {ctaLabel}
        </button>
      </div>
    </div>
  );
}
'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, ShoppingBag, Trash2 } from 'lucide-react';
import { useCartStore } from '@/hooks/useCart';
import { useCartDrawerStore } from '@/hooks/useCartDrawer';
import { formatPrice } from '@/utils';
import { PACK_CONFIG } from '@/types';

/**
 * Panel de carrito que se abre al agregar un producto o al tocar el
 * ícono del carrito del Navbar — SOLO en mobile/tablet (`md:hidden`,
 * ver src/lib/viewport.ts para el criterio que decide cuándo se abre).
 *
 * En desktop este componente no se llega a ver nunca (la clase `md:hidden`
 * lo oculta por completo) — ahí se mantiene el comportamiento de siempre:
 * toast al agregar, e ícono del carrito que lleva directo a /carrito.
 *
 * Se monta una sola vez en el layout raíz (junto al Navbar) para que
 * funcione igual sin importar en qué página esté el usuario.
 */
export function CartDrawer() {
  const { items, subtotal, removeItem } = useCartStore();
  const { isOpen, close } = useCartDrawerStore();

  // Cerrar con Escape + bloquear el scroll del fondo mientras está abierto
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  return (
    <div
      className={`fixed inset-0 z-[100] md:hidden ${isOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        className={`absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-surface shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-xl font-bold">Carrito</h2>
          <button
            onClick={close}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
            aria-label="Cerrar carrito"
          >
            <X size={18} /> Cerrar
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag size={44} className="text-muted opacity-30" />
            <p className="text-sm font-medium text-muted">Tu carrito está vacío</p>
            <Link href="/productos" onClick={close} className="btn-primary text-sm">
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => {
                const key = `${item.productId}-${item.tipoPack}-${item.variantId ?? 'novar'}`;
                return (
                  <div key={key} className="flex gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {item.imagen ? (
                        <Image src={item.imagen} alt={item.nombre} fill className="object-cover" sizes="64px" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted">
                          <ShoppingBag size={18} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight line-clamp-2">{item.nombre}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {item.cantidadPacks} × {PACK_CONFIG[item.tipoPack].labelCorto}
                        {item.variantLabel ? ` · ${item.variantLabel}` : ''}
                      </p>
                      <p className="text-sm font-bold text-brand-600 mt-1">{formatPrice(item.subtotal)}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId, item.tipoPack, item.variantId)}
                      className="self-start p-1 text-muted hover:text-red-500 transition-colors"
                      aria-label={`Quitar ${item.nombre}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer fijo: subtotal + acciones */}
            <div className="border-t border-border px-5 py-4 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Subtotal:</span>
                <span className="text-lg font-bold text-brand-600">{formatPrice(subtotal)}</span>
              </div>
              <Link href="/carrito" onClick={close} className="btn-secondary w-full text-center block">
                Ver carrito
              </Link>
              <Link href="/checkout" onClick={close} className="btn-primary w-full text-center block">
                Finalizar compra
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
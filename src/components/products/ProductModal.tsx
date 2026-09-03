'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Minus, Plus, Package } from 'lucide-react';
import { cn, formatPrice, getPrecioEscalonado, getProximoEscalon } from '@/utils';
import { useCartStore } from '@/hooks/useCart';
import type { Product, TipoPack } from '@/types';
import toast from 'react-hot-toast';
import { ProductWhatsAppButton } from './ProductWhatsAppButton';

interface Props {
  product: Product;
  onClose: () => void;
}

/**
 * Modal de compra por PACK (media docena / docena) — venta mayorista.
 * La compra por unidad (con o sin variantes de talla/color) se maneja
 * directamente en la página del producto vía VariantSelector /
 * SimpleUnitBuyBox, no en este modal — evita duplicar el mismo flujo
 * en dos lugares distintos con datos potencialmente desincronizados.
 */
export function ProductModal({ product, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  // Media docena es opcional por producto — si no tiene precio cargado,
  // el único tipo de pack disponible es la docena completa.
  const tieneMediaDocena = product.precio_media_docena != null && product.precio_media_docena > 0;
  const [tipoPack, setTipoPack] = useState<Exclude<TipoPack, 'unidad'>>(tieneMediaDocena ? 'media_docena' : 'docena');
  const [cantidad, setCantidad] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);

  const maxMediaDocena = Math.floor(product.stock_unidades / 6);
  const maxDocena      = Math.floor(product.stock_unidades / 12);
  const maxCantidad    = tipoPack === 'media_docena' ? maxMediaDocena : maxDocena;
  const unidadesPack   = tipoPack === 'media_docena' ? 6 : 12;
  // Docena: aplica precio escalonado por volumen si el producto tiene tiers.
  const precio         = tipoPack === 'media_docena'
    ? (product.precio_media_docena ?? 0)
    : getPrecioEscalonado(product.precio_tiers, cantidad, product.precio_docena);
  const totalUnidades  = cantidad * unidadesPack;
  const totalPrecio    = cantidad * precio;
  const proximoEscalon = tipoPack === 'docena' ? getProximoEscalon(product.precio_tiers, cantidad) : null;

  useEffect(() => {
    setCantidad((c) => Math.min(c, maxCantidad || 1));
  }, [tipoPack, maxCantidad]);

  const handleAdd = () => {
    addItem({
      productId:      product.id,
      productSlug:    product.slug,
      nombre:         product.nombre,
      imagen:         product.imagenes[0] ?? '',
      tipoPack,
      cantidadPacks:  cantidad,
      unidades:       totalUnidades,
      precioUnitario: precio,
      precioTiers:      tipoPack === 'docena' ? product.precio_tiers : undefined,
      precioBaseDocena: tipoPack === 'docena' ? product.precio_docena : undefined,
    });
    const label = tipoPack === 'media_docena' ? 'Media Docena (6 uds)' : 'Docena (12 uds)';
    toast.success(`${cantidad} ${label} agregado${cantidad > 1 ? 's' : ''} al carrito`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-2xl animate-scale-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 hover:bg-surface-2 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="grid md:grid-cols-2">
          {/* Images */}
          <div className="bg-surface-2 rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none overflow-hidden">
            <div className="relative aspect-square">
              {product.imagenes[imgIndex] ? (
                <Image
                  src={product.imagenes[imgIndex]}
                  alt={product.nombre}
                  fill className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted"><Package size={60} /></div>
              )}
            </div>
            {product.imagenes.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {product.imagenes.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={cn('relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                      imgIndex === i ? 'border-brand-500' : 'border-transparent opacity-60 hover:opacity-100')}
                  >
                    <Image src={img} alt="" fill className="object-cover" sizes="56px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col gap-4">
            <div>
              <h2 className="font-display text-xl font-bold">{product.nombre}</h2>
              {product.descripcion && (
                <p className="mt-2 text-sm text-muted leading-relaxed">{product.descripcion}</p>
              )}
            </div>

            {/* Stock info */}
            <div className="rounded-xl bg-surface-2 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Stock disponible</span>
                <span className="font-semibold">{product.stock_unidades} unidades</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Máx. media docena</span>
                <span className="font-semibold">{maxMediaDocena} packs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Máx. docena</span>
                <span className="font-semibold">{maxDocena} packs</span>
              </div>
            </div>

            {/* Colores & talles — informativo (la selección real, si aplica, está en la página) */}
            {product.colores.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Colores</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.colores.map((c) => (
                    <span key={c} className="badge bg-surface-2 text-foreground">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {product.talles.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Talles</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.talles.map((t) => (
                    <span key={t} className="badge bg-surface-2 text-foreground">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Pack selector — media docena solo si el producto tiene precio cargado */}
            <div>
              <p className="text-xs font-medium mb-2">Tipo de pack</p>
              <div className={cn('grid gap-2', tieneMediaDocena ? 'grid-cols-2' : 'grid-cols-1')}>
                {(tieneMediaDocena ? (['media_docena', 'docena'] as const) : (['docena'] as const)).map((t) => {
                  const max      = t === 'media_docena' ? maxMediaDocena : maxDocena;
                  const price    = (t === 'media_docena' ? product.precio_media_docena : product.precio_docena) ?? 0;
                  const sinStock = max === 0;
                  const label    = t === 'media_docena' ? 'Media Docena (6 uds)' : 'Docena (12 uds)';
                  const subLabel = sinStock
                    ? (t === 'docena' && maxMediaDocena > 0 ? 'Sin stock para Docena' : 'Sin stock')
                    : formatPrice(price);
                  return (
                    <button
                      key={t}
                      disabled={sinStock}
                      onClick={() => setTipoPack(t)}
                      title={sinStock && t === 'docena' && maxMediaDocena > 0
                        ? `Solo ${product.stock_unidades} unidades disponibles, necesitás 12 para docena`
                        : undefined}
                      className={cn(
                        'rounded-xl border-2 p-3 text-left transition-all text-sm',
                        tipoPack === t
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                          : 'border-border hover:border-brand-300',
                        sinStock && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900/20'
                      )}
                    >
                      <p className="font-semibold text-xs">{label}</p>
                      <p className={cn('font-bold', sinStock ? 'text-red-400 text-xs' : 'text-brand-600')}>
                        {subLabel}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <p className="text-xs font-medium">Cantidad</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="rounded-lg border p-1.5 hover:bg-surface-2 disabled:opacity-40"
                  disabled={cantidad <= 1}
                ><Minus size={14} /></button>
                <span className="w-8 text-center text-sm font-semibold">{cantidad}</span>
                <button
                  onClick={() => setCantidad(Math.min(maxCantidad, cantidad + 1))}
                  className="rounded-lg border p-1.5 hover:bg-surface-2 disabled:opacity-40"
                  disabled={cantidad >= maxCantidad}
                ><Plus size={14} /></button>
              </div>
            </div>

            {/* Aviso de próximo escalón de precio por volumen */}
            {proximoEscalon && (
              <p className="text-xs text-brand-600 bg-brand-50 dark:bg-brand-950/20 rounded-lg px-2.5 py-1.5">
                📦 Comprando {proximoEscalon.min_docenas}+ docenas, pagás {formatPrice(proximoEscalon.precio_docena)} c/u
                {proximoEscalon.min_docenas - cantidad === 1
                  ? ' — ¡te falta solo 1 docena!'
                  : ` — te faltan ${proximoEscalon.min_docenas - cantidad} docenas`}
              </p>
            )}

            {/* Summary */}
            <div className="rounded-xl bg-brand-50 dark:bg-brand-950/20 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Total unidades</span>
                <span className="font-semibold">{totalUnidades} uds</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted">Total a pagar</span>
                <span className="text-lg font-bold text-brand-600">{formatPrice(totalPrecio)}</span>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={maxCantidad === 0}
              className="btn-primary w-full"
            >
              <ShoppingCart size={16} />
              {maxCantidad === 0 ? 'Sin stock' : 'Agregar al carrito'}
            </button>

            <ProductWhatsAppButton
              productName={product.nombre}
              productUrl={typeof window !== 'undefined' ? `${window.location.origin}/productos/${product.slug}` : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

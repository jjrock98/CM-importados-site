'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Minus, ShoppingCart, Check, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/hooks/useCart';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/utils';
import type { Product, ProductVariant } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  product: Product;
  initialVariants: ProductVariant[];
}

/**
 * Selector interactivo de talla + color con stock real por combinación,
 * usado en la ficha de producto (/productos/[slug]) cuando el producto
 * tiene venta minorista con variantes cargadas.
 *
 * Solo permite seleccionar combinaciones que EXISTEN y tienen stock > 0
 * — nunca se puede armar en el carrito una combinación sin existencia.
 * El stock se actualiza en tiempo real vía Supabase Realtime: si otro
 * cliente agota una combinación, se deshabilita en pantalla al instante.
 */
export function VariantSelector({ product, initialVariants }: Props) {
  const { addItem } = useCartStore();
  const [variants,  setVariants]  = useState<ProductVariant[]>(initialVariants);
  const [adding,    setAdding]    = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const tallas = useMemo(() => [...new Set(variants.map((v) => v.talla))], [variants]);
  const [tallaSel, setTallaSel] = useState<string | null>(tallas[0] ?? null);

  const coloresDeTalla = useMemo(
    () => variants.filter((v) => v.talla === tallaSel),
    [variants, tallaSel]
  );
  const [colorSel, setColorSel] = useState<string | null>(
    coloresDeTalla.find((v) => v.stock_unidades > 0)?.color ?? coloresDeTalla[0]?.color ?? null
  );

  // Si cambia la talla, resetear el color a la primera opción con stock
  useEffect(() => {
    const disponibles = variants.filter((v) => v.talla === tallaSel);
    setColorSel(disponibles.find((v) => v.stock_unidades > 0)?.color ?? disponibles[0]?.color ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tallaSel]);

  const selectedVariant = variants.find((v) => v.talla === tallaSel && v.color === colorSel) ?? null;
  const stockDisponible = selectedVariant?.stock_unidades ?? 0;
  const sinStock         = !selectedVariant || stockDisponible < 1;

  const min = product.stock_minorista_min || 1;
  const max = Math.min(product.stock_minorista_max || 12, stockDisponible);
  const [cantidad, setCantidad] = useState(min);

  useEffect(() => {
    setCantidad((c) => Math.min(Math.max(c, min), Math.max(max, min)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.id, max]);

  // ✅ Stock por variante en tiempo real (Supabase Realtime)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`product-variants-${product.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'product_variants', filter: `product_id=eq.${product.id}`,
      }, (payload) => {
        const updated = payload.new as ProductVariant;
        setVariants((prev) => prev.map((v) => v.id === updated.id ? { ...v, ...updated } : v));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [product.id]);

  const totalPrecio = (product.precio_unitario ?? 0) * cantidad;

  const handleAdd = useCallback(async () => {
    if (sinStock || !selectedVariant || !product.precio_unitario) {
      toast.error('Elegí una combinación de talla y color con stock disponible');
      return;
    }
    setAdding(true);
    const result = await addItem({
      productId:      product.id,
      productSlug:    product.slug,
      nombre:         product.nombre,
      imagen:         selectedVariant.imagen_url || product.imagenes[0] || '',
      tipoPack:       'unidad',
      cantidadPacks:  cantidad,
      unidades:       cantidad,
      precioUnitario: product.precio_unitario,
      esMinorista:    true,
      variantId:      selectedVariant.id,
      variantLabel:   `Talla ${selectedVariant.talla} / ${selectedVariant.color}`,
    });
    setAdding(false);
    if (result.ok) {
      setJustAdded(true);
      toast.success(`${cantidad} ${cantidad === 1 ? 'unidad agregada' : 'unidades agregadas'} al carrito`);
      setTimeout(() => setJustAdded(false), 2500);
    } else {
      toast.error(result.error ?? 'No se pudo agregar');
    }
  }, [addItem, cantidad, product, sinStock, selectedVariant]);

  if (variants.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-950/10 p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          🏪 Comprar por unidad
        </p>
        <p className="text-lg font-black text-brand-600">
          {formatPrice(product.precio_unitario ?? 0)} <span className="text-xs font-normal text-muted">c/u</span>
        </p>
      </div>

      {/* Selector de talla */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Talla</p>
        <div className="flex flex-wrap gap-2">
          {tallas.map((t) => {
            const disponible = variants.some((v) => v.talla === t && v.stock_unidades > 0);
            return (
              <button
                key={t}
                disabled={!disponible}
                onClick={() => setTallaSel(t)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  tallaSel === t
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : disponible
                      ? 'border-border hover:border-brand-400'
                      : 'border-border text-muted opacity-40 cursor-not-allowed line-through'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector de color */}
      {tallaSel && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Color</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(variants.filter((v) => v.talla === tallaSel).map((v) => v.color))].map((c) => {
              const variant    = variants.find((v) => v.talla === tallaSel && v.color === c);
              const disponible = (variant?.stock_unidades ?? 0) > 0;
              return (
                <button
                  key={c}
                  disabled={!disponible}
                  onClick={() => setColorSel(c)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    colorSel === c
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : disponible
                        ? 'border-border hover:border-brand-400'
                        : 'border-border text-muted opacity-40 cursor-not-allowed line-through'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock de la combinación elegida */}
      <p className={`text-xs flex items-center gap-1.5 ${sinStock ? 'text-red-500' : stockDisponible < 3 ? 'text-orange-500' : 'text-muted'}`}>
        {sinStock ? (
          <><AlertTriangle size={12} /> Sin stock en esta combinación</>
        ) : (
          `✓ ${stockDisponible} unidades disponibles en Talla ${tallaSel} / ${colorSel}`
        )}
      </p>

      {/* Cantidad + Agregar */}
      {!sinStock && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setCantidad((c) => Math.max(min, c - 1))}
              disabled={cantidad <= min}
              className="px-3 py-2 hover:bg-surface-2 disabled:opacity-40 transition-colors"
              aria-label="Restar"
            ><Minus size={13} /></button>
            <span className="w-10 text-center text-sm font-bold tabular-nums">{cantidad}</span>
            <button
              onClick={() => setCantidad((c) => Math.min(max, c + 1))}
              disabled={cantidad >= max}
              className="px-3 py-2 hover:bg-surface-2 disabled:opacity-40 transition-colors"
              aria-label="Sumar"
            ><Plus size={13} /></button>
          </div>

          <button
            onClick={handleAdd}
            disabled={adding || justAdded}
            className="flex-1 btn-primary py-2.5 text-sm gap-2 justify-center"
          >
            {adding ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : justAdded ? (
              <><Check size={15} /> ¡Agregado!</>
            ) : (
              <><ShoppingCart size={15} /> Agregar — {formatPrice(totalPrecio)}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

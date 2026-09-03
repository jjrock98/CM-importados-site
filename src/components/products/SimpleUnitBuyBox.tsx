'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, ShoppingCart, Check } from 'lucide-react';
import { useCartStore } from '@/hooks/useCart';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/utils';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

/**
 * Compra por unidad para productos minoristas SIN variantes de
 * talla/color — usa el stock general del producto directamente.
 */
export function SimpleUnitBuyBox({ product: initial }: { product: Product }) {
  const { addItem } = useCartStore();
  const [product, setProduct] = useState(initial);
  const [adding,  setAdding]  = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const min = product.stock_minorista_min || 1;
  const max = Math.min(product.stock_minorista_max || 12, product.stock_unidades);
  const [cantidad, setCantidad] = useState(min);
  const sinStock = product.stock_unidades < min;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`product-unit-${product.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${product.id}`,
      }, (payload) => setProduct((prev) => ({ ...prev, ...(payload.new as Partial<Product>) })))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [product.id]);

  const handleAdd = useCallback(async () => {
    if (sinStock || !product.precio_unitario) return;
    setAdding(true);
    const result = await addItem({
      productId:      product.id,
      productSlug:    product.slug,
      nombre:         product.nombre,
      imagen:         product.imagenes[0] ?? '',
      tipoPack:       'unidad',
      cantidadPacks:  cantidad,
      unidades:       cantidad,
      precioUnitario: product.precio_unitario,
      esMinorista:    true,
    });
    setAdding(false);
    if (result.ok) {
      setJustAdded(true);
      toast.success(`${cantidad} ${cantidad === 1 ? 'unidad agregada' : 'unidades agregadas'} al carrito`);
      setTimeout(() => setJustAdded(false), 2500);
    } else {
      toast.error(result.error ?? 'No se pudo agregar');
    }
  }, [addItem, cantidad, product, sinStock]);

  if (sinStock || !product.precio_unitario) return null;

  return (
    <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-950/10 p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">🏪 Comprar por unidad</p>
        <p className="text-lg font-black text-brand-600">
          {formatPrice(product.precio_unitario)} <span className="text-xs font-normal text-muted">c/u</span>
        </p>
      </div>
      <p className="text-xs text-muted">{product.stock_unidades} disponibles · mín. {min} · máx. {max}</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border overflow-hidden">
          <button onClick={() => setCantidad((c) => Math.max(min, c - 1))} disabled={cantidad <= min}
            className="px-3 py-2 hover:bg-surface-2 disabled:opacity-40" aria-label="Restar"><Minus size={13} /></button>
          <span className="w-10 text-center text-sm font-bold tabular-nums">{cantidad}</span>
          <button onClick={() => setCantidad((c) => Math.min(max, c + 1))} disabled={cantidad >= max}
            className="px-3 py-2 hover:bg-surface-2 disabled:opacity-40" aria-label="Sumar"><Plus size={13} /></button>
        </div>
        <button onClick={handleAdd} disabled={adding || justAdded} className="flex-1 btn-primary py-2.5 text-sm gap-2 justify-center">
          {adding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : justAdded ? <><Check size={15} /> ¡Agregado!</>
            : <><ShoppingCart size={15} /> Agregar — {formatPrice((product.precio_unitario ?? 0) * cantidad)}</>}
        </button>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Minus, ShoppingCart, Package, AlertTriangle, Check, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCartStore } from '@/hooks/useCart';
import { formatPrice } from '@/utils';
import { createClient } from '@/lib/supabase/client';
import type { Product, ProductVariant } from '@/types';
import toast from 'react-hot-toast';

// ── Tarjeta individual minorista ─────────────────────────────────────────────

function MinoristaCard({ product: initial }: { product: Product }) {
  const { addItem } = useCartStore();
  const [product,   setProduct]   = useState(initial);
  const [variants,  setVariants]  = useState<ProductVariant[]>(initial.variants ?? []);
  const [adding,    setAdding]    = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const hasVariants = variants.length > 0;

  // ── Selección de talla / color ──────────────────────────────────────────
  const tallas = useMemo(() => [...new Set(variants.map((v) => v.talla))], [variants]);
  const [tallaSel, setTallaSel] = useState<string | null>(tallas[0] ?? null);

  const coloresDeTalla = useMemo(
    () => variants.filter((v) => v.talla === tallaSel && v.stock_unidades > 0),
    [variants, tallaSel]
  );
  const [colorSel, setColorSel] = useState<string | null>(coloresDeTalla[0]?.color ?? null);

  // Si cambia la talla, resetear el color a la primera opción disponible
  useEffect(() => {
    setColorSel(coloresDeTalla[0]?.color ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tallaSel]);

  const selectedVariant = hasVariants
    ? variants.find((v) => v.talla === tallaSel && v.color === colorSel) ?? null
    : null;

  // Stock efectivo: de la variante seleccionada, o del producto si no hay variantes
  const stockDisponible = hasVariants ? (selectedVariant?.stock_unidades ?? 0) : product.stock_unidades;

  const min = product.stock_minorista_min || 1;
  const max = Math.min(product.stock_minorista_max || 12, stockDisponible);
  const [cantidad, setCantidad] = useState(min);

  useEffect(() => {
    setCantidad((c) => Math.min(Math.max(c, min), Math.max(max, min)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.id, max]);

  // ✅ Stock en tiempo real — producto (sin variantes) y variantes (con selector)
  useEffect(() => {
    const supabase = createClient();
    const channels = [
      supabase.channel(`minorista-prod-${product.id}`).on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${product.id}`,
      }, (payload) => {
        setProduct((prev) => ({ ...prev, ...(payload.new as Partial<Product>) }));
      }).subscribe(),
    ];

    if (hasVariants) {
      channels.push(
        supabase.channel(`minorista-variants-${product.id}`).on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'product_variants', filter: `product_id=eq.${product.id}`,
        }, (payload) => {
          const updated = payload.new as ProductVariant;
          setVariants((prev) => prev.map((v) => v.id === updated.id ? { ...v, ...updated } : v));
        }).subscribe()
      );
    }

    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [product.id, hasVariants]);

  const sinStockGeneral = !hasVariants && product.stock_unidades < min;
  const sinVarianteSeleccionada = hasVariants && (!selectedVariant || selectedVariant.stock_unidades < 1);
  const sinStock = sinStockGeneral || sinVarianteSeleccionada;

  const totalPrecio = (product.precio_unitario ?? 0) * cantidad;

  const precioPorUnidadEnPack = (product.precio_media_docena ?? 0) > 0 ? (product.precio_media_docena as number) / 6 : null;
  const esMasCaro = precioPorUnidadEnPack !== null && (product.precio_unitario ?? 0) > precioPorUnidadEnPack;

  const handleAdd = useCallback(async () => {
    if (sinStock || !product.precio_unitario) return;
    if (hasVariants && !selectedVariant) {
      toast.error('Elegí talla y color');
      return;
    }
    setAdding(true);
    const result = await addItem({
      productId:      product.id,
      productSlug:    product.slug,
      nombre:         product.nombre,
      imagen:         selectedVariant?.imagen_url || product.imagenes[0] || '',
      tipoPack:       'unidad',
      cantidadPacks:  cantidad,
      unidades:       cantidad,
      precioUnitario: product.precio_unitario,
      esMinorista:    true,
      variantId:      selectedVariant?.id ?? null,
      variantLabel:   selectedVariant ? `Talla ${selectedVariant.talla} / ${selectedVariant.color}` : null,
    });
    setAdding(false);
    if (result.ok) {
      setJustAdded(true);
      toast.success(`${cantidad} ${cantidad === 1 ? 'unidad agregada' : 'unidades agregadas'} al carrito`);
      setTimeout(() => setJustAdded(false), 2500);
    } else {
      toast.error(result.error ?? 'No se pudo agregar');
    }
  }, [addItem, cantidad, product, sinStock, hasVariants, selectedVariant]);

  const displayImage = selectedVariant?.imagen_url || product.imagenes[0];

  return (
    <motion.div
      className="card overflow-hidden group"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
    >
      {/* Imagen */}
      <Link
        href={`/productos/${product.slug}`}
        className="relative block overflow-hidden bg-surface-2"
        style={{ aspectRatio: '1/1' }}
      >
        {displayImage ? (
          <Image
            src={displayImage} alt={product.nombre} fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <Package size={40} />
          </div>
        )}
        {sinStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-gray-800">Agotado</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
          Unitario
        </span>
      </Link>

      {/* Info */}
      <div className="p-4">
        <Link href={`/productos/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight hover:text-brand-600 transition-colors">
            {product.nombre}
          </h3>
        </Link>
        {product.descripcion_corta && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">{product.descripcion_corta}</p>
        )}

        {/* Precio */}
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-brand-600">
              {formatPrice(product.precio_unitario ?? 0)}
            </span>
            <span className="text-xs text-muted">/ unidad</span>
          </div>
          {precioPorUnidadEnPack !== null && esMasCaro && (
            <p className="text-[10px] mt-1 flex items-center gap-1">
              <span className="rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 font-bold">
                {Math.round(((product.precio_unitario ?? 0) - precioPorUnidadEnPack) / (product.precio_unitario ?? 1) * 100)}% más barato en pack
              </span>
              <Link href="/productos" className="text-muted underline underline-offset-2 hover:text-brand-600">
                Ver packs
              </Link>
            </p>
          )}
        </div>

        {/* ── Selector de talla ────────────────────────────────────────── */}
        {hasVariants && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1.5">Talla</p>
            <div className="flex flex-wrap gap-1.5">
              {tallas.map((t) => {
                const disponible = variants.some((v) => v.talla === t && v.stock_unidades > 0);
                return (
                  <button
                    key={t}
                    disabled={!disponible}
                    onClick={() => setTallaSel(t)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
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
        )}

        {/* ── Selector de color ────────────────────────────────────────── */}
        {hasVariants && tallaSel && (
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1.5">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(variants.filter((v) => v.talla === tallaSel).map((v) => v.color))].map((c) => {
                const variant     = variants.find((v) => v.talla === tallaSel && v.color === c);
                const disponible  = (variant?.stock_unidades ?? 0) > 0;
                return (
                  <button
                    key={c}
                    disabled={!disponible}
                    onClick={() => setColorSel(c)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
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

        {/* Stock indicator */}
        <p className={`mt-2 text-xs flex items-center gap-1 ${sinStock ? 'text-red-500' : stockDisponible < min * 3 ? 'text-orange-500' : 'text-muted'}`}>
          {sinStock ? (
            <><AlertTriangle size={10} /> {hasVariants ? 'Sin stock en esta combinación' : 'Sin stock disponible'}</>
          ) : (
            `${stockDisponible} uds disponibles · ${min} mín. · ${max} máx.`
          )}
        </p>

        {/* Cantidad + Agregar */}
        {!sinStock && product.precio_unitario && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setCantidad((c) => Math.max(min, c - 1))}
                  disabled={cantidad <= min}
                  className="px-2.5 py-2 hover:bg-surface-2 disabled:opacity-40 transition-colors"
                  aria-label="Restar"
                >
                  <Minus size={12} />
                </button>
                <span className="w-8 text-center text-sm font-bold tabular-nums">{cantidad}</span>
                <button
                  onClick={() => setCantidad((c) => Math.min(max, c + 1))}
                  disabled={cantidad >= max}
                  className="px-2.5 py-2 hover:bg-surface-2 disabled:opacity-40 transition-colors"
                  aria-label="Sumar"
                >
                  <Plus size={12} />
                </button>
              </div>
              <span className="text-sm font-semibold text-muted">= {formatPrice(totalPrecio)}</span>
            </div>

            <button
              onClick={handleAdd}
              disabled={adding || justAdded}
              className="w-full btn-primary py-2 text-xs gap-1.5 justify-center"
            >
              {adding ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : justAdded ? (
                <><Check size={13} /> ¡Agregado al carrito!</>
              ) : (
                <><ShoppingCart size={13} /> Agregar al carrito</>
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Grid del catálogo minorista ───────────────────────────────────────────────

export function MinoristaGrid({ products, initialSearch }: { products: Product[]; initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch ?? '');

  const filtered = products.filter((p) =>
    !search ||
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.descripcion_corta ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Buscador */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="input-base pl-9 max-w-xs"
          />
        </div>
        <span className="text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">No hay productos que coincidan.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => <MinoristaCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
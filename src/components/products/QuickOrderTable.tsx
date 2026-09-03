'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Package, ShoppingCart, Loader2, Search } from 'lucide-react';
import { useCartStore } from '@/hooks/useCart';
import { formatPrice, getPrecioEscalonado } from '@/utils';
import type { Product } from '@/types';
import toast from 'react-hot-toast';

interface Props { products: Product[] }

/**
 * Fila = un producto. Solo se pide cantidad de DOCENAS (el pack estándar
 * mayorista) para mantener el flujo simple — media docena y curva siguen
 * disponibles en la ficha de producto normal para quien las necesite.
 */
export function QuickOrderTable({ products }: Props) {
  const router  = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [search, setSearch]   = useState('');
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [products, search]);

  const setCantidad = (productId: string, value: number, maxDocenas: number) => {
    const v = Math.max(0, Math.min(value, maxDocenas));
    setCantidades((prev) => ({ ...prev, [productId]: v }));
  };

  const totalSeleccionado = useMemo(
    () => Object.values(cantidades).reduce((a, c) => a + c, 0),
    [cantidades]
  );

  const handleAgregarTodo = async () => {
    const seleccionados = Object.entries(cantidades).filter(([, c]) => c > 0);
    if (seleccionados.length === 0) {
      toast.error('Cargá alguna cantidad primero');
      return;
    }

    setSubmitting(true);
    let agregados = 0;
    const saltados: string[] = [];

    for (const [productId, cantidadPacks] of seleccionados) {
      const product = products.find((p) => p.id === productId);
      if (!product) continue;

      const precioUnit = getPrecioEscalonado(product.precio_tiers, cantidadPacks, product.precio_docena);

      const result = await addItem({
        productId:      product.id,
        productSlug:    product.slug,
        nombre:         product.nombre,
        imagen:         product.imagenes[0] ?? '',
        tipoPack:       'docena',
        cantidadPacks,
        unidades:       cantidadPacks * 12,
        precioUnitario: precioUnit,
        precioTiers:      product.precio_tiers,
        precioBaseDocena: product.precio_docena,
      });

      if (result.ok) agregados++;
      else saltados.push(product.nombre);
    }

    setSubmitting(false);

    if (agregados > 0) {
      toast.success(`${agregados} producto${agregados !== 1 ? 's' : ''} agregado${agregados !== 1 ? 's' : ''} al carrito`);
    }
    if (saltados.length > 0) {
      toast.error(`Sin stock suficiente: ${saltados.join(', ')}`, { duration: 5000 });
    }
    if (agregados > 0) {
      setCantidades({});
      router.push('/carrito');
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto…"
          className="input-base pl-9 py-2 text-sm max-w-sm"
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2">
            <tr className="text-left text-xs text-muted">
              <th className="p-3">Producto</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Precio / docena</th>
              <th className="p-3 w-40">Cant. de packs (docenas)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => {
              const maxDocenas = Math.floor(p.stock_unidades / 12);
              const cantidad   = cantidades[p.id] ?? 0;
              const precioActual = getPrecioEscalonado(p.precio_tiers, cantidad || 1, p.precio_docena);
              const sinStock   = maxDocenas === 0;

              return (
                <tr key={p.id} className={sinStock ? 'opacity-40' : ''}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                        {p.imagenes[0] ? (
                          <Image src={p.imagenes[0]} alt={p.nombre} fill sizes="40px" className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted"><Package size={16} /></div>
                        )}
                      </div>
                      <span className="font-medium line-clamp-1">{p.nombre}</span>
                    </div>
                  </td>
                  <td className="p-3 text-muted">
                    {sinStock ? <span className="text-red-500 font-medium">Sin stock</span> : `${maxDocenas} docenas`}
                  </td>
                  <td className="p-3 font-semibold text-brand-600">{formatPrice(precioActual)}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      max={maxDocenas}
                      value={cantidad || ''}
                      disabled={sinStock}
                      onChange={(e) => setCantidad(p.id, Number(e.target.value), maxDocenas)}
                      placeholder="0"
                      className="input-base w-24 py-1.5 text-sm disabled:opacity-50"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botón único global — procesa todos los inputs cargados */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleAgregarTodo}
          disabled={submitting || totalSeleccionado === 0}
          className="btn-primary gap-2 shadow-lg disabled:opacity-50"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Agregando…</>
            : <><ShoppingCart size={16} /> Agregar {totalSeleccionado > 0 ? `${totalSeleccionado} pack${totalSeleccionado !== 1 ? 's' : ''}` : ''} al carrito</>}
        </button>
      </div>
    </div>
  );
}

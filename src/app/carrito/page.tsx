'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, ShoppingBag, Minus, Plus, Truck, AlertTriangle, MessageCircle } from 'lucide-react';
import { useCartStore } from '@/hooks/useCart';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/utils';
import { PACK_CONFIG } from '@/types';
import toast from 'react-hot-toast';

// Stock en tiempo real por producto Y por variante (talla/color) en el carrito
function useCartStock(productIds: string[], variantIds: string[]) {
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (productIds.length > 0) {
      supabase.from('products').select('id, stock_unidades').in('id', productIds)
        .then(({ data }) => {
          if (data) {
            const map: Record<string, number> = {};
            data.forEach((p) => { map[p.id] = p.stock_unidades; });
            setProductStocks(map);
          }
        });
      channels.push(
        supabase.channel('cart-stock-watch').on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'products',
        }, (payload) => {
          const p = payload.new as { id: string; stock_unidades: number };
          if (productIds.includes(p.id)) setProductStocks((prev) => ({ ...prev, [p.id]: p.stock_unidades }));
        }).subscribe()
      );
    }

    if (variantIds.length > 0) {
      supabase.from('product_variants').select('id, stock_unidades').in('id', variantIds)
        .then(({ data }) => {
          if (data) {
            const map: Record<string, number> = {};
            data.forEach((v) => { map[v.id] = v.stock_unidades; });
            setVariantStocks(map);
          }
        });
      channels.push(
        supabase.channel('cart-variant-stock-watch').on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'product_variants',
        }, (payload) => {
          const v = payload.new as { id: string; stock_unidades: number };
          if (variantIds.includes(v.id)) setVariantStocks((prev) => ({ ...prev, [v.id]: v.stock_unidades }));
        }).subscribe()
      );
    }

    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds.join(','), variantIds.join(',')]);

  return { productStocks, variantStocks };
}

export default function CarritoPage() {
  const { items, subtotal, removeItem, updateQuantity } = useCartStore();
  const [updating, setUpdating]= useState<string | null>(null);
  const [downloadingQuote, setDownloadingQuote] = useState(false);

  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.filter((i) => i.variantId).map((i) => i.variantId as string))];
  const { productStocks, variantStocks } = useCartStock(productIds, variantIds);

  const handleQtyChange = useCallback(async (
    productId: string, tipoPack: 'media_docena' | 'docena' | 'unidad', newQty: number, variantId?: string | null
  ) => {
    const key = `${productId}-${tipoPack}-${variantId ?? 'novar'}`;
    setUpdating(key);
    const result = await updateQuantity(productId, tipoPack, newQty, variantId);
    if (!result.ok) {
      toast.error(result.error ?? 'Stock insuficiente');
    }
    setUpdating(null);
  }, [updateQuantity]);

  const handleDescargarPresupuesto = async () => {
    if (items.length === 0) return;
    setDownloadingQuote(true);
    try {
      const res = await fetch('/api/orders/export-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            nombre:         i.nombre,
            tipoPack:       i.tipoPack,
            cantidadPacks:  i.cantidadPacks,
            precioUnitario: i.precioUnitario,
            subtotal:       i.subtotal,
          })),
          // El envío ya no se calcula automáticamente — se coordina
          // personalmente (WhatsApp/Tawk.to) después del pedido.
          costoEnvio: 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'No se pudo generar el presupuesto');
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `presupuesto-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al descargar el presupuesto');
    } finally {
      setDownloadingQuote(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <ShoppingBag size={56} className="text-muted opacity-30" />
        <p className="text-lg font-semibold text-muted">Tu carrito está vacío</p>
        <Link href="/" className="btn-primary">Ver productos</Link>
      </div>
    );
  }

  const getLiveStock = (item: typeof items[number]) =>
    item.variantId ? variantStocks[item.variantId] : productStocks[item.productId];

  // Verificar si hay algún item con stock insuficiente
  const hasStockIssue = items.some((item) => {
    const live = getLiveStock(item);
    return live !== undefined && live < item.unidades;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold mb-8">Mi carrito</h1>

      {hasStockIssue && (
        <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Algunos productos ya no tienen suficiente stock. Ajustá las cantidades antes de continuar.
          </p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const key         = `${item.productId}-${item.tipoPack}-${item.variantId ?? 'novar'}`;
            const liveStock   = getLiveStock(item);
            const isUpdating  = updating === key;

            const unitsPerPack      = item.tipoPack === 'media_docena' ? 6 : item.tipoPack === 'docena' ? 12 : 1;
            const maxPacks           = liveStock !== undefined ? Math.floor(liveStock / unitsPerPack) : 99;
            const stockInsuficiente  = liveStock !== undefined && liveStock < item.unidades;

            return (
              <div key={key} className="card flex gap-4 p-4 animate-fade-in">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {item.imagen ? (
                    <Image src={item.imagen} alt={item.nombre} fill className="object-cover" sizes="80px" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight line-clamp-2">{item.nombre}</p>
                  <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {PACK_CONFIG[item.tipoPack].labelCorto}
                    {item.esMinorista && (
                      <span className="rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-1.5 py-0.5 text-[10px] font-semibold">
                        Minorista
                      </span>
                    )}
                    {item.variantLabel && (
                      <span className="rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-semibold">
                        {item.variantLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">{item.unidades} unidades · {formatPrice(item.precioUnitario)}/pack</p>

                  {stockInsuficiente && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      Solo quedan {liveStock} unidades disponibles
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleQtyChange(item.productId, item.tipoPack, item.cantidadPacks - 1, item.variantId)}
                        disabled={item.cantidadPacks <= 1 || isUpdating}
                        className="rounded-lg border p-1 hover:bg-surface-2 disabled:opacity-40"
                      ><Minus size={12} /></button>

                      <span className="w-6 text-center text-sm font-semibold">
                        {isUpdating ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> : item.cantidadPacks}
                      </span>

                      <button
                        onClick={() => handleQtyChange(item.productId, item.tipoPack, item.cantidadPacks + 1, item.variantId)}
                        disabled={isUpdating || item.cantidadPacks >= maxPacks}
                        title={item.cantidadPacks >= maxPacks ? `Máximo disponible: ${maxPacks} pack${maxPacks !== 1 ? 's' : ''}` : undefined}
                        className="rounded-lg border p-1 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      ><Plus size={12} /></button>
                    </div>

                    <span className="text-sm font-bold text-brand-600">{formatPrice(item.subtotal)}</span>

                    {liveStock !== undefined && (
                      <span className="text-[10px] text-muted ml-auto">
                        {liveStock < item.unidades
                          ? <span className="text-red-400">⚠️ Stock: {liveStock}</span>
                          : `Stock: ${liveStock}`}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { removeItem(item.productId, item.tipoPack, item.variantId); toast('Producto eliminado'); }}
                  className="text-muted hover:text-red-500 transition-colors p-1 self-start"
                ><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="card p-5 border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-950/10">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Truck size={16} className="text-brand-500" /> Envío a coordinar
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              El costo y la modalidad de envío se coordinan personalmente después de confirmar tu pedido —
              por WhatsApp, por el chat de la web, o como prefieras contactarnos. No se calcula automáticamente acá.
            </p>
            <div className="flex gap-2 mt-3">
              {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola! Quiero consultar sobre el envío de mi pedido.')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-secondary flex-1 text-xs py-2 justify-center gap-1.5"
                >
                  <MessageCircle size={13} /> WhatsApp
                </a>
              )}
              <span className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border text-xs py-2 text-muted">
                <MessageCircle size={13} /> Chat en vivo
              </span>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold">Resumen</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Envío</span>
              <span className="text-xs text-muted">A coordinar</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-brand-600 text-lg">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-[11px] text-muted -mt-1">El total no incluye el envío — se coordina aparte.</p>
            <Link
              href="/checkout"
              className={`btn-primary w-full mt-2 text-center ${hasStockIssue ? 'opacity-50 pointer-events-none' : ''}`}
              aria-disabled={hasStockIssue}
            >
              {hasStockIssue ? 'Ajustá las cantidades' : 'Ir a pagar'}
            </Link>
            <Link href="/" className="btn-ghost w-full text-center text-sm">
              Seguir comprando
            </Link>
            <button
              onClick={handleDescargarPresupuesto}
              disabled={downloadingQuote}
              className="btn-ghost w-full text-center text-sm border border-border gap-2 disabled:opacity-50"
            >
              {downloadingQuote ? 'Generando…' : '📥 Descargar Presupuesto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Loader2 } from 'lucide-react';
import { useCartStore } from '@/hooks/useCart';
import type { TipoPack } from '@/types';
import toast from 'react-hot-toast';

interface RepetirItem {
  productId:   string;
  productSlug: string;
  nombre:      string;
  imagen:      string;
  tipoPack:    TipoPack;
  cantidadPacks: number;
  unidades:    number;
  precioUnit:  number;
  variantId:   string | null;
  variantLabel: string | null;
}

/**
 * Botón "Repetir pedido" — toma los ítems de un pedido pasado y los agrega
 * al carrito EN LOTE, verificando stock real contra Supabase para cada uno
 * (vía useCart.addItem, que ya hace esa validación por lectura antes de
 * agregar — no hace falta reimplementarla acá).
 *
 * Si algún ítem ya no tiene stock suficiente, se informa cuál se saltó
 * pero se agregan igual los que sí están disponibles — no bloquea todo
 * el lote por un solo producto agotado.
 */
export function RepetirPedidoButton({ items }: { items: RepetirItem[] }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (items.length === 0) {
      toast.error('Este pedido no tiene productos para repetir');
      return;
    }

    setLoading(true);
    let agregados = 0;
    const saltados: string[] = [];

    for (const item of items) {
      // La docena/media docena usa el precio ACTUAL del producto (los
      // precios pudieron cambiar desde el pedido original) — igual que
      // hace ProductModal, el checkout recalcula el precio real como
      // fuente de verdad en el servidor de todos modos.
      const result = await addItem({
        productId:      item.productId,
        productSlug:    item.productSlug,
        nombre:         item.nombre,
        imagen:         item.imagen,
        tipoPack:       item.tipoPack,
        cantidadPacks:  item.cantidadPacks,
        unidades:       item.unidades,
        precioUnitario: item.precioUnit,
        variantId:      item.variantId,
        variantLabel:   item.variantLabel,
      });
      if (result.ok) {
        agregados++;
      } else {
        saltados.push(item.nombre);
      }
    }

    setLoading(false);

    if (agregados > 0) {
      toast.success(`${agregados} producto${agregados !== 1 ? 's' : ''} agregado${agregados !== 1 ? 's' : ''} al carrito`);
    }
    if (saltados.length > 0) {
      toast.error(`Sin stock suficiente: ${saltados.join(', ')}`, { duration: 5000 });
    }
    if (agregados > 0) {
      router.push('/carrito');
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-brand-600 hover:underline font-medium disabled:opacity-50"
    >
      {loading
        ? <><Loader2 size={11} className="animate-spin" /> Verificando stock…</>
        : <><RotateCcw size={11} /> Repetir pedido</>}
    </button>
  );
}

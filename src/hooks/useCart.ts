import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import type { CartItem, TipoPack } from '@/types';
import { pixelAddToCart } from '@/lib/fbpixel';
import { getPrecioEscalonado } from '@/utils';

/**
 * ============================================================
 * REGLA DE NEGOCIO 1 — Carrito sin reserva de stock
 * ============================================================
 * Agregar, quitar o modificar cantidades en el carrito NUNCA
 * resta ni reserva stock en la base de datos. El carrito es
 * 100% local (Zustand + localStorage). El stock permanece
 * disponible para todos los usuarios simultáneamente hasta
 * que el cliente confirma el pedido en /checkout.
 *
 * La única validación que se hace acá es una LECTURA (SELECT,
 * sin lock) del stock actual, solo para dar feedback inmediato
 * en la UI. Esto no reserva nada — el stock real se vuelve a
 * verificar (con lock) recién en el checkout.
 *
 * Con variantes (talla/color), la identidad de un ítem del
 * carrito es la combinación (productId, tipoPack, variantId) —
 * dos colores del mismo producto son líneas distintas.
 * ============================================================
 */

async function leerStockActual(productId: string, variantId?: string | null): Promise<number | null> {
  const supabase = createClient();
  if (variantId) {
    const { data } = await supabase
      .from('product_variants')
      .select('stock_unidades')
      .eq('id', variantId)
      .single();
    return data?.stock_unidades ?? null;
  }
  const { data } = await supabase
    .from('products')
    .select('stock_unidades')
    .eq('id', productId)
    .single();
  return data?.stock_unidades ?? null;
}

function sameLine(i: CartItem, productId: string, tipoPack: TipoPack, variantId?: string | null) {
  return i.productId === productId && i.tipoPack === tipoPack && (i.variantId ?? null) === (variantId ?? null);
}

interface CartStore {
  items: CartItem[];

  addItem: (item: Omit<CartItem, 'subtotal'>) => Promise<{ ok: boolean; error?: string }>;
  removeItem: (productId: string, tipoPack: TipoPack, variantId?: string | null) => void;
  updateQuantity: (productId: string, tipoPack: TipoPack, cantidadPacks: number, variantId?: string | null) => Promise<{ ok: boolean; error?: string }>;
  clearCart: () => void;

  readonly subtotal: number;
  readonly total: number;
  readonly itemCount: number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      // ── addItem — NO reserva stock, solo valida por lectura ──────────────
      addItem: async (item) => {
        // Para productos CON variante, el stock se cuenta por variante
        // (no por producto entero). Para productos sin variante, se
        // suma entre todos los tipoPack del mismo producto como antes.
        const currentItems = item.variantId
          ? get().items.filter((i) => i.variantId === item.variantId)
          : get().items.filter((i) => i.productId === item.productId && !i.variantId);
        const currentUnits = currentItems.reduce((a, i) => a + i.unidades, 0);
        const totalUnits   = currentUnits + item.unidades;

        const stockActual = await leerStockActual(item.productId, item.variantId);
        if (stockActual !== null && totalUnits > stockActual) {
          return {
            ok: false,
            error: stockActual === 0
              ? 'Esta combinación de talla/color no tiene stock disponible'
              : `Solo hay ${stockActual} unidades disponibles de esta variante`,
          };
        }

        set((state) => {
          const existing = state.items.find((i) => sameLine(i, item.productId, item.tipoPack, item.variantId));
          if (existing) {
            const newCantidadPacks = existing.cantidadPacks + item.cantidadPacks;
            const precioUnitario = existing.tipoPack === 'docena' && existing.precioBaseDocena != null
              ? getPrecioEscalonado(existing.precioTiers, newCantidadPacks, existing.precioBaseDocena)
              : existing.precioUnitario;
            return {
              items: state.items.map((i) =>
                sameLine(i, item.productId, item.tipoPack, item.variantId)
                  ? {
                      ...i,
                      cantidadPacks: newCantidadPacks,
                      unidades:      i.unidades + item.unidades,
                      precioUnitario,
                      subtotal:      newCantidadPacks * precioUnitario,
                    }
                  : i
              ),
            };
          }
          // Línea nueva: si es docena, aplicar el escalón que corresponda desde el inicio.
          const precioUnitarioInicial = item.tipoPack === 'docena' && item.precioBaseDocena != null
            ? getPrecioEscalonado(item.precioTiers, item.cantidadPacks, item.precioBaseDocena)
            : item.precioUnitario;
          return { items: [...state.items, { ...item, precioUnitario: precioUnitarioInicial, subtotal: item.cantidadPacks * precioUnitarioInicial }] };
        });

        pixelAddToCart({
          contentIds:  [item.productId],
          contentName: item.variantLabel ? `${item.nombre} (${item.variantLabel})` : item.nombre,
          value:       item.precioUnitario,
        });
        return { ok: true };
      },

      // ── removeItem — puramente local, no llama a Supabase ────────────────
      removeItem: (productId, tipoPack, variantId = null) => {
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, productId, tipoPack, variantId)),
        }));
      },

      // ── updateQuantity — valida por lectura, no reserva ───────────────────
      updateQuantity: async (productId, tipoPack, cantidadPacks, variantId = null) => {
        if (cantidadPacks <= 0) {
          get().removeItem(productId, tipoPack, variantId);
          return { ok: true };
        }

        const unitsPerPack = tipoPack === 'media_docena' ? 6 : tipoPack === 'docena' ? 12 : 1;
        const newPackUnits = cantidadPacks * unitsPerPack;

        const otherUnits = variantId
          ? get().items.filter((i) => i.variantId === variantId && i.tipoPack !== tipoPack).reduce((a, i) => a + i.unidades, 0)
          : get().items.filter((i) => i.productId === productId && !i.variantId && i.tipoPack !== tipoPack).reduce((a, i) => a + i.unidades, 0);
        const totalUnits = otherUnits + newPackUnits;

        const stockActual = await leerStockActual(productId, variantId);
        if (stockActual !== null && totalUnits > stockActual) {
          return { ok: false, error: `Solo hay ${stockActual} unidades disponibles` };
        }

        set((state) => ({
          items: state.items.map((i) => {
            if (!sameLine(i, productId, tipoPack, variantId)) return i;
            // Docena: recalcular precio escalonado según la nueva cantidad
            // de docenas (puede subir o bajar de escalón al cambiar cantidad).
            const precioUnitario = i.tipoPack === 'docena' && i.precioBaseDocena != null
              ? getPrecioEscalonado(i.precioTiers, cantidadPacks, i.precioBaseDocena)
              : i.precioUnitario;
            return { ...i, cantidadPacks, unidades: newPackUnits, precioUnitario, subtotal: cantidadPacks * precioUnitario };
          }),
        }));
        return { ok: true };
      },

      // ── clearCart — puramente local ────────────────────────────────────────
      clearCart: () => {
        set({ items: [] });
      },

      get subtotal() { return get().items.reduce((acc, i) => acc + i.subtotal, 0); },
      // El envío se coordina manualmente (WhatsApp / Tawk.to / en persona),
      // no se calcula ni se suma acá — el total del carrito es el subtotal.
      get total()    { return get().subtotal; },
      get itemCount(){ return get().items.reduce((acc, i) => acc + i.cantidadPacks, 0); },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        items: state.items,
      }),
      // ⚠️ FIX crítico: no usar el merge por defecto de zustand/persist acá.
      // Ese merge hace `{ ...currentState, ...persistedState }`, y un
      // `{...obj}` EVALÚA los getters de `obj` (subtotal/total/itemCount)
      // en ese instante — cuando `items` todavía está vacío — y los
      // "congela" como un 0 fijo para siempre, aunque después se agreguen
      // productos. Acá reconstruimos el objeto preservando los getters
      // como getters reales (no como valores ya calculados) y solo
      // pisamos `items` con lo que vino guardado.
      merge: (persistedState, currentState) => {
        const merged = Object.create(Object.getPrototypeOf(currentState));
        Object.defineProperties(merged, Object.getOwnPropertyDescriptors(currentState));
        const persistedItems = (persistedState as Partial<CartStore> | undefined)?.items;
        if (Array.isArray(persistedItems)) merged.items = persistedItems;
        return merged;
      },
    }
  )
);
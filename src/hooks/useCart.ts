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

// ── Totales derivados ────────────────────────────────────────────────────
// ⚠️ IMPORTANTE: subtotal/total/itemCount NO son getters. Zustand combina
// cada `set()` haciendo `Object.assign({}, estadoViejo, parcialNuevo)`, y
// eso EVALÚA cualquier getter sobre el `estadoViejo` (antes de aplicar el
// cambio) y lo deja fijo como un número en el objeto resultante. Con un
// getter, el subtotal terminaba mostrando siempre el valor de ANTES del
// último cambio (ej: agregás una unidad y el total tarda un paso en
// reflejarlo, o directamente arranca en 0 y queda pegado ahí). Por eso acá
// se recalculan a mano en cada acción y se guardan como número plano —
// así siempre coinciden con `items` en el mismo instante en que cambian.
function deriveTotals(items: CartItem[]) {
  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
  return {
    subtotal,
    // El envío se coordina manualmente (WhatsApp / Tawk.to / en persona),
    // no se calcula ni se suma acá — el total del carrito es el subtotal.
    total: subtotal,
    itemCount: items.reduce((acc, i) => acc + i.cantidadPacks, 0),
  };
}

interface CartStore {
  items: CartItem[];
  subtotal: number;
  total: number;
  itemCount: number;

  addItem: (item: Omit<CartItem, 'subtotal'>) => Promise<{ ok: boolean; error?: string }>;
  removeItem: (productId: string, tipoPack: TipoPack, variantId?: string | null) => void;
  updateQuantity: (productId: string, tipoPack: TipoPack, cantidadPacks: number, variantId?: string | null) => Promise<{ ok: boolean; error?: string }>;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      subtotal: 0,
      total: 0,
      itemCount: 0,

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
            const newItems = state.items.map((i) =>
              sameLine(i, item.productId, item.tipoPack, item.variantId)
                ? {
                    ...i,
                    cantidadPacks: newCantidadPacks,
                    unidades:      i.unidades + item.unidades,
                    precioUnitario,
                    subtotal:      newCantidadPacks * precioUnitario,
                  }
                : i
            );
            return { items: newItems, ...deriveTotals(newItems) };
          }
          // Línea nueva: si es docena, aplicar el escalón que corresponda desde el inicio.
          const precioUnitarioInicial = item.tipoPack === 'docena' && item.precioBaseDocena != null
            ? getPrecioEscalonado(item.precioTiers, item.cantidadPacks, item.precioBaseDocena)
            : item.precioUnitario;
          const newItems = [...state.items, { ...item, precioUnitario: precioUnitarioInicial, subtotal: item.cantidadPacks * precioUnitarioInicial }];
          return { items: newItems, ...deriveTotals(newItems) };
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
        set((state) => {
          const newItems = state.items.filter((i) => !sameLine(i, productId, tipoPack, variantId));
          return { items: newItems, ...deriveTotals(newItems) };
        });
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

        set((state) => {
          const newItems = state.items.map((i) => {
            if (!sameLine(i, productId, tipoPack, variantId)) return i;
            // Docena: recalcular precio escalonado según la nueva cantidad
            // de docenas (puede subir o bajar de escalón al cambiar cantidad).
            const precioUnitario = i.tipoPack === 'docena' && i.precioBaseDocena != null
              ? getPrecioEscalonado(i.precioTiers, cantidadPacks, i.precioBaseDocena)
              : i.precioUnitario;
            return { ...i, cantidadPacks, unidades: newPackUnits, precioUnitario, subtotal: cantidadPacks * precioUnitario };
          });
          return { items: newItems, ...deriveTotals(newItems) };
        });
        return { ok: true };
      },

      // ── clearCart — puramente local ────────────────────────────────────────
      clearCart: () => {
        set({ items: [], subtotal: 0, total: 0, itemCount: 0 });
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        items: state.items,
      }),
      // Al hidratar desde localStorage solo se restauran los `items` (ver
      // partialize). subtotal/total/itemCount se recalculan acá a partir de
      // esos items para que arranquen siempre sincronizados, en vez de
      // heredar los valores en 0 del estado inicial.
      merge: (persistedState, currentState) => {
        const persistedItems = (persistedState as Partial<CartStore> | undefined)?.items;
        const items = Array.isArray(persistedItems) ? persistedItems : currentState.items;
        return { ...currentState, items, ...deriveTotals(items) };
      },
    }
  )
);
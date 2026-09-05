import { act, renderHook } from '@testing-library/react';
import { useCartStore } from '@/hooks/useCart';

// addItem/updateQuantity hacen un SELECT de solo lectura contra Supabase
// (leerStockActual) antes de mutar el estado, para avisar en la UI si no
// alcanza el stock — ver comentario "REGLA DE NEGOCIO 1" en useCart.ts.
// Se mockea el cliente para que ese SELECT resuelva al toque con stock
// "ilimitado" (no es lo que se está testeando acá) y no dependa de red.
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { stock_unidades: 9999 } }),
        }),
      }),
    }),
  }),
}));

jest.mock('@/lib/fbpixel', () => ({ pixelAddToCart: jest.fn() }));

// Reset store between tests
beforeEach(() => {
  useCartStore.setState({
    items: [],
  });
});

const ITEM_MEDIA_DOCENA = {
  productId:      'prod-1',
  productSlug:    'test-product',
  nombre:         'Producto Test',
  imagen:         '/test.jpg',
  tipoPack:       'media_docena' as const,
  cantidadPacks:  1,
  unidades:       6,
  precioUnitario: 1000,
};

const ITEM_DOCENA = {
  ...ITEM_MEDIA_DOCENA,
  tipoPack:      'docena' as const,
  cantidadPacks: 1,
  unidades:      12,
  precioUnitario: 1800,
};

// addItem/updateQuantity son async (ver mock de Supabase arriba) — hay que
// esperar la promesa dentro de act(), si no la aserción corre antes de que
// el estado se actualice y `items` queda vacío.
describe('Cart Store – addItem', () => {
  it('adds a new item', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].subtotal).toBe(1000);
  });

  it('increments existing item', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidadPacks).toBe(2);
  });

  it('treats same product with different pack as separate items', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    await act(async () => { await result.current.addItem(ITEM_DOCENA); });
    expect(result.current.items).toHaveLength(2);
  });
});

describe('Cart Store – removeItem', () => {
  it('removes an item', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    act(() => { result.current.removeItem('prod-1', 'media_docena'); });
    expect(result.current.items).toHaveLength(0);
  });

  it('only removes matching pack type', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    await act(async () => { await result.current.addItem(ITEM_DOCENA); });
    act(() => { result.current.removeItem('prod-1', 'media_docena'); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].tipoPack).toBe('docena');
  });
});

describe('Cart Store – updateQuantity', () => {
  it('updates quantity and subtotal', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    await act(async () => { await result.current.updateQuantity('prod-1', 'media_docena', 3); });
    expect(result.current.items[0].cantidadPacks).toBe(3);
    expect(result.current.items[0].subtotal).toBe(3000);
  });

  it('removes item when quantity set to 0', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    await act(async () => { await result.current.updateQuantity('prod-1', 'media_docena', 0); });
    expect(result.current.items).toHaveLength(0);
  });
});

describe('Cart Store – totals', () => {
  it('calculates subtotal correctly', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => {
      await result.current.addItem(ITEM_MEDIA_DOCENA); // 1000
      await result.current.addItem(ITEM_DOCENA);       // 1800
    });
    expect(result.current.subtotal).toBe(2800);
  });

  it('total equals subtotal — el envío ya no se calcula acá, se coordina aparte', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => { await result.current.addItem(ITEM_MEDIA_DOCENA); });
    expect(result.current.total).toBe(result.current.subtotal);
  });

  it('counts items correctly', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => {
      await result.current.addItem({ ...ITEM_MEDIA_DOCENA, cantidadPacks: 2 });
      await result.current.addItem(ITEM_DOCENA);
    });
    expect(result.current.itemCount).toBe(3);
  });
});

describe('Cart Store – clearCart', () => {
  it('clears all items', async () => {
    const { result } = renderHook(() => useCartStore());
    await act(async () => {
      await result.current.addItem(ITEM_MEDIA_DOCENA);
      result.current.clearCart();
    });
    expect(result.current.items).toHaveLength(0);
  });
});
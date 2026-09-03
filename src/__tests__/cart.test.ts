import { act, renderHook } from '@testing-library/react';
import { useCartStore } from '@/hooks/useCart';

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

describe('Cart Store – addItem', () => {
  it('adds a new item', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].subtotal).toBe(1000);
  });

  it('increments existing item', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidadPacks).toBe(2);
  });

  it('treats same product with different pack as separate items', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    act(() => { result.current.addItem(ITEM_DOCENA); });
    expect(result.current.items).toHaveLength(2);
  });
});

describe('Cart Store – removeItem', () => {
  it('removes an item', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    act(() => { result.current.removeItem('prod-1', 'media_docena'); });
    expect(result.current.items).toHaveLength(0);
  });

  it('only removes matching pack type', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    act(() => { result.current.addItem(ITEM_DOCENA); });
    act(() => { result.current.removeItem('prod-1', 'media_docena'); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].tipoPack).toBe('docena');
  });
});

describe('Cart Store – updateQuantity', () => {
  it('updates quantity and subtotal', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    act(() => { result.current.updateQuantity('prod-1', 'media_docena', 3); });
    expect(result.current.items[0].cantidadPacks).toBe(3);
    expect(result.current.items[0].subtotal).toBe(3000);
  });

  it('removes item when quantity set to 0', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    act(() => { result.current.updateQuantity('prod-1', 'media_docena', 0); });
    expect(result.current.items).toHaveLength(0);
  });
});

describe('Cart Store – totals', () => {
  it('calculates subtotal correctly', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem(ITEM_MEDIA_DOCENA); // 1000
      result.current.addItem(ITEM_DOCENA);       // 1800
    });
    expect(result.current.subtotal).toBe(2800);
  });

  it('total equals subtotal — el envío ya no se calcula acá, se coordina aparte', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => { result.current.addItem(ITEM_MEDIA_DOCENA); });
    expect(result.current.total).toBe(result.current.subtotal);
  });

  it('counts items correctly', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem({ ...ITEM_MEDIA_DOCENA, cantidadPacks: 2 });
      result.current.addItem(ITEM_DOCENA);
    });
    expect(result.current.itemCount).toBe(3);
  });
});

describe('Cart Store – clearCart', () => {
  it('clears all items', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem(ITEM_MEDIA_DOCENA);
      result.current.clearCart();
    });
    expect(result.current.items).toHaveLength(0);
  });
});

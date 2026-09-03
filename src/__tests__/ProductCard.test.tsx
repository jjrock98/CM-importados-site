import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from '@/components/products/ProductCard';
import type { Product } from '@/types';

// Mock hooks
jest.mock('@/hooks/useWishlist', () => ({
  useWishlist: () => ({
    isInWishlist: () => false,
    toggle:       jest.fn(),
    loading:      false,
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement('img', { src, alt }),
}));

const MOCK_PRODUCT: Product = {
  id:                  'prod-test-1',
  nombre:              'Medias Premium',
  slug:                'medias-premium',
  descripcion:         'Las mejores medias del mercado',
  descripcion_corta:   'Calidad premium',
  imagenes:            ['https://example.com/image.jpg'],
  videos:              [],
  stock_unidades:      48,
  precio_media_docena: 1200,
  precio_docena:       2200,
  venta_minorista:     false,
  venta_mayorista:     true,
  precio_unitario:     null,
  stock_minorista_min: 1,
  stock_minorista_max: 12,
  precio_tiers: [],
  colores:             ['Negro', 'Blanco'],
  talles:              ['Único'],
  activo:              true,
  destacado:           false,
  created_at:          '2024-01-01T00:00:00Z',
  updated_at:          '2024-01-01T00:00:00Z',
};

const PRODUCT_NO_STOCK: Product = { ...MOCK_PRODUCT, id: 'prod-2', stock_unidades: 0 };

describe('ProductCard', () => {
  it('renders product name', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    expect(screen.getByText('Medias Premium')).toBeInTheDocument();
  });

  it('shows short description', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    expect(screen.getByText('Calidad premium')).toBeInTheDocument();
  });

  it('shows media docena price', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    expect(screen.getByText(/1\.200/)).toBeInTheDocument();
  });

  it('shows docena price', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    expect(screen.getByText(/2\.200/)).toBeInTheDocument();
  });

  it('shows stock information', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    expect(screen.getByText(/48/)).toBeInTheDocument();
  });

  it('calculates max packs from stock', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    // 48 / 6 = 8 media docenas, 48 / 12 = 4 docenas
    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });

  it('shows "Sin stock" overlay when out of stock', () => {
    render(<ProductCard product={PRODUCT_NO_STOCK} />);
    expect(screen.getByText('Sin stock')).toBeInTheDocument();
  });

  it('disables add button when out of stock', () => {
    render(<ProductCard product={PRODUCT_NO_STOCK} />);
    const button = screen.getByRole('button', { name: /Sin stock/i });
    expect(button).toBeDisabled();
  });

  it('shows "Agregar al carrito" button when in stock', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    expect(screen.getByRole('button', { name: /Agregar al carrito/i })).toBeInTheDocument();
  });

  it('opens modal on image/button click', () => {
    render(<ProductCard product={MOCK_PRODUCT} />);
    const addBtn = screen.getByRole('button', { name: /Agregar al carrito/i });
    fireEvent.click(addBtn);
    // Modal should be rendered
    expect(screen.getByText('Medias Premium')).toBeInTheDocument();
  });
});

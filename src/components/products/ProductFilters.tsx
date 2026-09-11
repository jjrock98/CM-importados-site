'use client';
import { useState, useCallback, useMemo, useTransition } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { cn, formatPrice } from '@/utils';
import type { Product } from '@/types';

interface Props {
  products: Product[];
  /** Categorías con al menos un producto en TODO el catálogo (no solo esta página) — viene calculado del servidor. */
  categoriasDisponibles: { value: string; label: string }[];
  /** Categoría activa, leída de la URL (?categoria=...) — el filtro real ya se aplicó server-side. */
  categoriaActual: string;
  /** Búsqueda activa (?q=...), para no perderla al cambiar de categoría. */
  busqueda?: string;
  /** Ruta base para los links de categoría (chips). Por defecto '/' (home).
   *  Pasar '/productos' cuando este componente se usa en esa página, para
   *  que los chips no te saquen del catálogo dedicado. */
  basePath?: string;
}

type SortKey = 'relevancia' | 'precio_asc' | 'precio_desc' | 'nombre' | 'stock';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevancia',  label: 'Relevancia'        },
  { value: 'precio_asc',  label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
  { value: 'nombre',      label: 'Nombre A–Z'         },
  { value: 'stock',       label: 'Mayor stock primero' },
];

export function ProductFilters({ products, categoriasDisponibles, categoriaActual, busqueda, basePath = '/' }: Props) {
  const [query,       setQuery]       = useState('');
  const [sort,        setSort]        = useState<SortKey>('relevancia');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [priceMax,    setPriceMax]    = useState<number | ''>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [,            startTransition] = useTransition();

  // Arma el link de cada chip preservando la búsqueda de texto activa
  // (?q=...) y navegando siempre a página 1 — el filtro de categoría se
  // aplica server-side, así que esto es una navegación normal, no estado
  // local (por eso no se pierde al paginar).
  const hrefCategoria = (value: string) => {
    const qs = new URLSearchParams();
    if (value) qs.set('categoria', value);
    if (busqueda) qs.set('q', busqueda);
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  // Precio de referencia para filtrar/ordenar: media docena si el producto
  // la tiene habilitada, si no la docena completa (hay productos que solo
  // se venden por docena o por curva).
  const precioRef = (p: Product) => p.precio_media_docena ?? p.precio_docena;

  // Derived price range
  const maxPossiblePrice = useMemo(
    () => Math.max(...products.map(precioRef)),
    [products]
  );

  const filtered = useMemo(() => {
    let list = [...products];

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.descripcion?.toLowerCase().includes(q) ||
          p.descripcion_corta?.toLowerCase().includes(q) ||
          p.colores.some((c) => c.toLowerCase().includes(q)) ||
          p.talles.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Stock filter
    if (onlyInStock) list = list.filter((p) => p.stock_unidades >= 6);

    // ✅ La categoría YA viene filtrada del servidor (ver page.tsx) — acá
    // no hace falta filtrar de nuevo, "products" ya es solo esa categoría.

    // Price filter (por precio de referencia: media docena u, si no tiene, docena)
    if (priceMax !== '') list = list.filter((p) => precioRef(p) <= Number(priceMax));

    // Sort
    switch (sort) {
      case 'precio_asc':  list.sort((a, b) => precioRef(a) - precioRef(b)); break;
      case 'precio_desc': list.sort((a, b) => precioRef(b) - precioRef(a)); break;
      case 'nombre':      list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));         break;
      case 'stock':       list.sort((a, b) => b.stock_unidades - a.stock_unidades);            break;
      default:            list.sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0)); break;
    }

    return list;
  }, [products, query, sort, onlyInStock, priceMax]);

  const hasFilters = query || onlyInStock || priceMax !== '' || categoriaActual !== '';
  const clearAll   = () => { setQuery(''); setOnlyInStock(false); setPriceMax(''); setSort('relevancia'); };

  return (
    <div>
      {/* Category chips — solo aparecen las categorías que tienen productos, en TODO el catálogo */}
      {categoriasDisponibles.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href={hrefCategoria('')}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              categoriaActual === '' ? 'bg-brand-500 border-brand-500 text-white' : 'border-border text-muted hover:text-foreground'
            )}
          >
            Todos
          </a>
          {categoriasDisponibles.map((c) => (
            <a
              key={c.value}
              href={hrefCategoria(categoriaActual === c.value ? '' : c.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                categoriaActual === c.value ? 'bg-brand-500 border-brand-500 text-white' : 'border-border text-muted hover:text-foreground'
              )}
            >
              {c.label}
            </a>
          ))}
        </div>
      )}

      {/* Search + controls bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => startTransition(() => setQuery(e.target.value))}
            placeholder="Buscar productos, colores, talles…"
            className="input-base pl-9 py-2.5 text-sm"
            aria-label="Buscar productos"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input-base py-2.5 pl-3 pr-8 text-sm appearance-none cursor-pointer min-w-44"
            aria-label="Ordenar por"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={cn('btn-secondary gap-2 py-2.5 text-sm', filtersOpen && 'border-brand-500 text-brand-600')}
        >
          <SlidersHorizontal size={15} />
          Filtros
          {hasFilters && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">!</span>}
        </button>

        {hasFilters && (
          categoriaActual
            ? <a href={hrefCategoria('')} className="text-xs text-muted hover:text-red-500 transition-colors flex items-center gap-1">
                <X size={12} /> Limpiar filtros
              </a>
            : <button onClick={clearAll} className="text-xs text-muted hover:text-red-500 transition-colors flex items-center gap-1">
                <X size={12} /> Limpiar filtros
              </button>
        )}
      </div>

      {/* Expanded filters */}
      {filtersOpen && (
        <div className="card mb-6 p-4 animate-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* In stock */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox" checked={onlyInStock}
              onChange={(e) => setOnlyInStock(e.target.checked)}
              className="accent-brand-500 h-4 w-4"
            />
            <span className="text-sm">Solo con stock disponible</span>
          </label>

          {/* Max price */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">
              Precio máximo (½ docena)
              {priceMax !== '' && <span className="ml-1 text-brand-600 font-semibold">{formatPrice(Number(priceMax))}</span>}
            </label>
            <input
              type="range" min={0} max={maxPossiblePrice} step={100}
              value={priceMax === '' ? maxPossiblePrice : priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value) === maxPossiblePrice ? '' : Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>{formatPrice(0)}</span>
              <span>{formatPrice(maxPossiblePrice)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{filtered.length}</span>
          {' '}producto{filtered.length !== 1 ? 's' : ''}
          {query && <> para <strong>&ldquo;{query}&rdquo;</strong></>}
        </p>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted gap-3">
          <Search size={40} className="opacity-20" />
          <p className="text-center">No hay productos que coincidan con los filtros.</p>
          {categoriaActual
            ? <a href={hrefCategoria('')} className="btn-secondary text-sm py-2">Ver todos los productos</a>
            : <button onClick={clearAll} className="btn-secondary text-sm py-2">Ver todos los productos</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
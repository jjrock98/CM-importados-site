'use client';
import { useState, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
  /** Orden activo leído de la URL (?orden=...) cuando el orden se aplica en el servidor. */
  ordenActual?: string;
  /** Si es true, cambiar el orden navega (ordena TODO el catálogo, no solo la página visible). */
  ordenServidor?: boolean;
  /** Filtros aplicados en el servidor (?stock=1 y ?maxprecio=N). Solo se usan con ordenServidor. */
  soloStockActual?: boolean;
  maxPrecioActual?: number;
  /** Precio de referencia más alto de TODO el catálogo: tope del slider (no solo de la página visible). */
  precioMaximoCatalogo?: number;
}

type SortKey = 'relevancia' | 'nuevos' | 'precio_asc' | 'precio_desc' | 'nombre' | 'stock';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevancia',  label: 'Relevancia'        },
  { value: 'nuevos',      label: 'Más nuevos'        },
  { value: 'precio_asc',  label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
  { value: 'nombre',      label: 'Nombre A–Z'         },
  { value: 'stock',       label: 'Mayor stock primero' },
];

export function ProductFilters({ products, categoriasDisponibles, categoriaActual, busqueda, basePath = '/', ordenActual = '', ordenServidor = false, soloStockActual = false, maxPrecioActual = 0, precioMaximoCatalogo = 0 }: Props) {
  const router = useRouter();
  // En el catálogo (ordenServidor) el texto se busca en TODO el catálogo, en el servidor:
  // se arranca con el ?q= actual y se navega al presionar Enter. En la home sigue siendo
  // un filtro instantáneo sobre las tarjetas cargadas.
  const [query,       setQuery]       = useState<string>(ordenServidor ? (busqueda ?? '') : '');
  const [sort,        setSort]        = useState<SortKey>(ordenServidor && ordenActual ? (ordenActual as SortKey) : 'relevancia');
  const [onlyInStock, setOnlyInStock] = useState(ordenServidor ? soloStockActual : false);
  const [priceMax,    setPriceMax]    = useState<number | ''>(ordenServidor && maxPrecioActual > 0 ? maxPrecioActual : '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [,            startTransition] = useTransition();

  // Con filtros en el servidor, si cambia la URL (botón Atrás/Adelante, link de categoría)
  // el estado local se vuelve a alinear con ella. Patrón oficial de React para "estado
  // derivado de props": se actualiza durante el render, solo cuando algo cambió.
  const urlKey = `${busqueda ?? ''}|${ordenActual}|${soloStockActual}|${maxPrecioActual}`;
  const [prevUrlKey, setPrevUrlKey] = useState(urlKey);
  if (ordenServidor && prevUrlKey !== urlKey) {
    setPrevUrlKey(urlKey);
    setQuery(busqueda ?? '');
    setSort(ordenActual ? (ordenActual as SortKey) : 'relevancia');
    setOnlyInStock(soloStockActual);
    setPriceMax(maxPrecioActual > 0 ? maxPrecioActual : '');
  }

  // Arma el link de la página 1 con TODOS los filtros activos (categoría, texto, orden,
  // solo stock, precio máximo); `o` pisa solo lo que cambia. Es navegación normal del
  // servidor, así que los filtros no se pierden al paginar.
  const buildHref = (o: { categoria?: string; q?: string; orden?: string; stock?: boolean; max?: number | '' } = {}) => {
    const qs = new URLSearchParams();
    const cat = o.categoria ?? categoriaActual;
    if (cat) qs.set('categoria', cat);
    const q = (o.q ?? busqueda ?? '').trim();
    if (q) qs.set('q', q);
    const ord = o.orden ?? (ordenServidor ? sort : '');
    if (ord && ord !== 'relevancia') qs.set('orden', ord);
    const st = o.stock ?? (ordenServidor ? onlyInStock : false);
    if (st) qs.set('stock', '1');
    const mx = o.max ?? (ordenServidor ? priceMax : '');
    if (mx !== '' && Number(mx) > 0) qs.set('maxprecio', String(Math.round(Number(mx))));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const hrefCategoria = (value: string) => buildHref({ categoria: value });

  // Con orden en el servidor, cambiar el selector navega a la página 1 con ?orden=...
  const onSort = (v: SortKey) => {
    setSort(v);
    if (ordenServidor) router.push(buildHref({ orden: v }));
  };

  // Buscar en el catálogo completo (conserva categoría, orden y filtros).
  const goSearch = (text: string) => router.push(buildHref({ q: text }));

  const onToggleStock = (checked: boolean) => {
    setOnlyInStock(checked);
    if (ordenServidor) router.push(buildHref({ stock: checked }));
  };
  // El slider solo navega al soltarlo (mientras se arrastra, cambia el valor mostrado).
  const commitPrice = () => { if (ordenServidor) router.push(buildHref({ max: priceMax })); };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ordenServidor) goSearch(query);
  };

  // Precio de referencia para filtrar/ordenar: media docena si el producto
  // la tiene habilitada, si no la docena completa (hay productos que solo
  // se venden por docena o por curva).
  const precioRef = (p: Product) => p.precio_media_docena ?? p.precio_docena;

  // Derived price range
  const maxPossiblePrice = useMemo(
    () => (ordenServidor && precioMaximoCatalogo > 0 ? precioMaximoCatalogo : Math.max(...products.map(precioRef))),
    [products, ordenServidor, precioMaximoCatalogo]
  );

  const filtered = useMemo(() => {
    let list = [...products];

    // Text search
    if (!ordenServidor && query.trim()) {
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
    if (!ordenServidor && onlyInStock) list = list.filter((p) => p.stock_unidades >= 6);

    // ✅ La categoría YA viene filtrada del servidor (ver page.tsx) — acá
    // no hace falta filtrar de nuevo, "products" ya es solo esa categoría.

    // Price filter (por precio de referencia: media docena u, si no tiene, docena)
    if (!ordenServidor && priceMax !== '') list = list.filter((p) => precioRef(p) <= Number(priceMax));

    // Sort (si el orden lo aplicó el servidor, se respeta tal cual llegó)
    if (!ordenServidor) switch (sort) {
      case 'nuevos':      list.sort((a, b) => b.created_at.localeCompare(a.created_at));        break;
      case 'precio_asc':  list.sort((a, b) => precioRef(a) - precioRef(b)); break;
      case 'precio_desc': list.sort((a, b) => precioRef(b) - precioRef(a)); break;
      case 'nombre':      list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));         break;
      case 'stock':       list.sort((a, b) => b.stock_unidades - a.stock_unidades);            break;
      default:            list.sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0)); break;
    }

    return list;
  }, [products, query, sort, onlyInStock, priceMax, ordenServidor]);

  const hasFilters = ordenServidor
    ? !!(busqueda || categoriaActual || soloStockActual || maxPrecioActual > 0)
    : !!(query || onlyInStock || priceMax !== '' || categoriaActual !== '');
  const clearAll   = () => {
    setQuery(''); setOnlyInStock(false); setPriceMax(''); setSort('relevancia');
    if (ordenServidor) router.push(basePath);
  };

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
        <form onSubmit={onSearchSubmit} role="search" className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => (ordenServidor ? setQuery(e.target.value) : startTransition(() => setQuery(e.target.value)))}
            placeholder={ordenServidor ? 'Buscar en todo el catálogo…' : 'Buscar productos, colores, talles…'}
            enterKeyHint="search"
            className="input-base pl-9 py-2.5 text-sm"
            aria-label="Buscar productos"
          />
          {query && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => { setQuery(''); if (ordenServidor && busqueda) goSearch(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
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
          categoriaActual && !ordenServidor
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
              onChange={(e) => onToggleStock(e.target.checked)}
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
              onMouseUp={commitPrice}
              onTouchEnd={commitPrice}
              onKeyUp={commitPrice}
              aria-label="Precio máximo"
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>{formatPrice(0)}</span>
              <span>{formatPrice(maxPossiblePrice)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Results count (en el catálogo, el total real lo muestra la página, no este) */}
      {!ordenServidor && <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{filtered.length}</span>
          {' '}producto{filtered.length !== 1 ? 's' : ''}
          {query && <> para <strong>&ldquo;{query}&rdquo;</strong></>}
        </p>
      </div>}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted gap-3">
          <Search size={40} className="opacity-20" />
          <p className="text-center">No hay productos que coincidan con los filtros.</p>
          {categoriaActual && !ordenServidor
            ? <a href={hrefCategoria('')} className="btn-secondary text-sm py-2">Ver todos los productos</a>
            : <button onClick={clearAll} className="btn-secondary text-sm py-2">Ver todos los productos</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {/* Las primeras 4 tarjetas son las que quedan arriba de todo sin
              scroll (2 filas de a 2 en mobile, 1 fila en desktop) — se
              cargan sin lazy para no retrasar el LCP. Ver comentario en
              ProductCard.tsx. */}
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
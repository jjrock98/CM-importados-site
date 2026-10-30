import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { env } from '@/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProductFilters } from '@/components/products/ProductFilters';
import { PageHero } from '@/components/common/PageHero';
import { AnimateIn } from '@/components/common/AnimateIn';
import { CATEGORIAS, categoriaLabel } from '@/lib/categorias';
import type { Product } from '@/types';
import type { Metadata } from 'next';
import { ShoppingBag } from 'lucide-react';

export const metadata: Metadata = {
  title:       'Productos',
  description: 'Catálogo completo: indumentaria, sandalias y zuecos importados por docena cerrada. Talles y colores surtidos.',
  alternates:  { canonical: `${env.APP_URL}/productos`, languages: { 'es-AR': `${env.APP_URL}/productos`, 'x-default': `${env.APP_URL}/productos` } },
  openGraph: {
    siteName:    'MC Importados',
    locale:      'es_AR',
    title:       '🔥 Catálogo Mayorista | MC Importados',
    description: 'Indumentaria, sandalias y zuecos importados por docena cerrada. Mirá los ingresos de Nike, Luofu, Adidas y marcas urbanas.',
    url:         `${env.APP_URL}/productos`,
    type:        'website',
    images: [{
      url:    `${env.APP_URL}/og-productos.png`,
      width:  1200,
      height: 630,
      alt:    'Catálogo Mayorista — MC Importados',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       '🔥 Catálogo Mayorista | MC Importados',
    description: 'Indumentaria, sandalias y zuecos importados por docena cerrada. Mirá los ingresos de Nike, Luofu, Adidas y marcas urbanas.',
    images:      [`${env.APP_URL}/og-productos.png`],
  },
};

export const revalidate = 60;

const POR_PAGINA = 12;

// Orden aplicado en el servidor (sobre todo el catálogo, no solo la página visible).
const ORDENES: Record<string, { col: string; asc: boolean }> = {
  nuevos:      { col: 'created_at',     asc: false },
  precio_asc:  { col: 'precio_docena',  asc: true  },
  precio_desc: { col: 'precio_docena',  asc: false },
  nombre:      { col: 'nombre',         asc: true  },
  stock:       { col: 'stock_unidades', asc: false },
};

interface ConsultaCatalogo {
  busqueda: string;
  categoria: string;
  orden: string;
  soloStock: boolean;
  maxPrecio: number;
  offset: number;
}
interface FilaCatalogo { categoria: string; precio_docena: number; precio_media_docena: number | null }

// Misma query base que usa la home (ver src/app/page.tsx) — mismo criterio de
// "activo" + "venta_mayorista", misma paginación y filtros.
async function consultarProductos(c: ConsultaCatalogo) {
  let q = createAdminClient()
    .from('products')
    .select('*', { count: 'exact' })
    .eq('activo', true)
    .eq('venta_mayorista', true);

  q = (c.orden
    ? q.order(ORDENES[c.orden].col, { ascending: ORDENES[c.orden].asc }).order('created_at', { ascending: false })
    : q.order('destacado', { ascending: false }).order('created_at', { ascending: false })
  ).range(c.offset, c.offset + POR_PAGINA - 1);

  if (c.busqueda) {
    q = q.or(`nombre.ilike.%${c.busqueda}%,descripcion_corta.ilike.%${c.busqueda}%,descripcion.ilike.%${c.busqueda}%`);
  }
  if (c.categoria) q = q.eq('categoria', c.categoria);
  if (c.soloStock) q = q.gte('stock_unidades', 6);
  if (c.maxPrecio) {
    // precio de referencia <= tope: media docena si existe; si no, la docena
    q = q.or(`precio_media_docena.lte.${c.maxPrecio},and(precio_media_docena.is.null,precio_docena.lte.${c.maxPrecio})`);
  }

  const { data, count } = await q;
  return { products: (data ?? []) as Product[], total: count ?? 0 };
}

async function consultarFilasCatalogo(): Promise<FilaCatalogo[]> {
  const { data } = await createAdminClient()
    .from('products')
    .select('categoria, precio_docena, precio_media_docena')
    .eq('activo', true)
    .eq('venta_mayorista', true);
  return (data ?? []) as FilaCatalogo[];
}

// Caché de 60 s en el servidor: la mayoría de las visitas del catálogo no tocan la base
// de datos. Un cambio de precio o stock puede tardar hasta 1 minuto en verse en el listado
// (igual que ya pasaba con la portada y las fichas de producto).
const consultarProductosCacheada = unstable_cache(consultarProductos, ['catalogo-productos'], { revalidate: 60 });
const filasCatalogoCacheadas     = unstable_cache(consultarFilasCatalogo, ['catalogo-filas'], { revalidate: 60 });

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; q?: string; categoria?: string; orden?: string; stock?: string; maxprecio?: string }>;
}) {
  const params   = await searchParams;
  const pagina   = Math.max(1, parseInt(params.pagina ?? '1', 10));
  // Se quitan los caracteres que tienen significado dentro del filtro .or() de
  // PostgREST (coma, paréntesis, %, *, \): sin esto un texto como "a,b" rompía
  // o alteraba el filtro. También se limita el largo.
  const busqueda = (params.q ?? '').replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const categoria = params.categoria?.trim() ?? '';
  const orden = Object.keys(ORDENES).includes(params.orden ?? '') ? (params.orden as string) : '';
  // Filtros "solo con stock" y "precio máximo": también en el servidor (antes solo
  // recortaban las 12 tarjetas visibles). Mismos criterios que tenía el filtro local:
  // stock >= 6 uds (media docena) y precio de referencia = media docena, o la docena
  // si el producto no tiene media docena.
  const soloStock = params.stock === '1';
  const maxPrecioNum = Math.floor(Number(params.maxprecio ?? ''));
  const maxPrecio = Number.isFinite(maxPrecioNum) && maxPrecioNum > 0 ? Math.min(maxPrecioNum, 100_000_000) : 0;
  const extraQs =
    (busqueda  ? `&q=${encodeURIComponent(busqueda)}` : '') +
    (categoria ? `&categoria=${encodeURIComponent(categoria)}` : '') +
    (orden     ? `&orden=${orden}` : '') +
    (soloStock ? '&stock=1' : '') +
    (maxPrecio ? `&maxprecio=${maxPrecio}` : '');
  const offset     = (pagina - 1) * POR_PAGINA;

  // Solo se cachean las combinaciones "normales" (sin texto de búsqueda, categoría válida,
  // sin tope de precio y primeras páginas): así nadie puede llenar el caché con variantes
  // inventadas en la URL. El resto consulta directo a la base.
  const consulta: ConsultaCatalogo = { busqueda, categoria, orden, soloStock, maxPrecio, offset };
  const cacheable =
    !busqueda && !maxPrecio && pagina <= 20 &&
    (categoria === '' || CATEGORIAS.some((c) => c.value === categoria));

  const [{ products, total: totalProductos }, filasCatalogo] = await Promise.all([
    cacheable ? consultarProductosCacheada(consulta) : consultarProductos(consulta),
    filasCatalogoCacheadas(),
  ]);

  const productList    = products;
  const totalPaginas   = Math.ceil(totalProductos / POR_PAGINA);
  const hayAnterior    = pagina > 1;
  const haySiguiente   = pagina < totalPaginas;
  const categoriasPresentes = new Set(filasCatalogo.map((r) => r.categoria));
  // Tope del slider de precio: el más caro de TODO el catálogo (no solo de la página visible).
  const precioMaximoCatalogo = Math.max(0, ...filasCatalogo.map((r) => Number(r.precio_media_docena ?? r.precio_docena) || 0));
  const categoriasDisponibles = CATEGORIAS.filter((c) => categoriasPresentes.has(c.value));

  return (
    <>
      <PageHero
        eyebrow="Catálogo completo"
        title="Productos"
        description="Indumentaria, sandalias y zuecos importados por docena cerrada."
        icon={<ShoppingBag size={28} />}
        compact
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Contador. El buscador vive en la barra de filtros (ProductFilters):
            antes había dos buscadores seguidos y el de arriba duplicaba al de abajo. */}
        <AnimateIn className="mb-4">
          <p className="text-sm text-muted">
            {totalProductos ?? 0} {(totalProductos ?? 0) === 1 ? 'producto' : 'productos'}
            {busqueda && <> para &ldquo;{busqueda}&rdquo;</>}
            {categoria && <> en <strong>{categoriaLabel(categoria)}</strong></>}
          </p>
        </AnimateIn>

        {productList.length === 0 ? (
          <AnimateIn className="rounded-2xl border border-dashed border-border py-20 text-center text-muted">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p>
              {busqueda
                ? `Sin resultados para "${busqueda}"`
                : categoria
                  ? `No hay productos en "${categoriaLabel(categoria)}" todavía.`
                  : 'No hay productos disponibles aún.'}
            </p>
            <form action="/productos" method="GET" className="mx-auto mt-5 flex max-w-sm gap-2 px-4">
              <input name="q" defaultValue={busqueda} placeholder="Probá con otra búsqueda…"
                aria-label="Buscar productos" className="input-base text-sm" />
              <button type="submit" className="btn-primary px-4 py-2 text-sm">Buscar</button>
            </form>
            {(busqueda || categoria || soloStock || maxPrecio > 0) && (
              <Link href="/productos" className="btn-secondary mt-4 text-sm px-4 py-2">Ver todo el catálogo</Link>
            )}
          </AnimateIn>
        ) : (
          <>
            <ProductFilters
              products={productList}
              categoriasDisponibles={categoriasDisponibles}
              categoriaActual={categoria}
              busqueda={busqueda}
              basePath="/productos"
              ordenActual={orden}
              ordenServidor
              soloStockActual={soloStock}
              maxPrecioActual={maxPrecio}
              precioMaximoCatalogo={precioMaximoCatalogo}
            />

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
                {hayAnterior && (
                  <a
                    href={`/productos?pagina=${pagina - 1}${extraQs}`}
                    className="btn-secondary text-sm px-4 py-2 gap-1.5"
                  >
                    ← Anterior
                  </a>
                )}

                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - pagina) <= 2 || p === 1 || p === totalPaginas)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...'
                      ? <span key={`dots-${i}`} className="text-muted px-1">…</span>
                      : (
                        <a
                          key={p}
                          href={`/productos?pagina=${p}${extraQs}`}
                          className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                            p === pagina
                              ? 'bg-brand-500 text-white'
                              : 'border border-border hover:border-brand-400 hover:text-brand-600'
                          }`}
                        >
                          {p}
                        </a>
                      )
                  )}

                {haySiguiente && (
                  <a
                    href={`/productos?pagina=${pagina + 1}${extraQs}`}
                    className="btn-secondary text-sm px-4 py-2 gap-1.5"
                  >
                    Siguiente →
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
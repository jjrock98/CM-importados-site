import Link from 'next/link';
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
  alternates:  { canonical: `${env.APP_URL}/productos` },
  openGraph: {
    title:       'Productos',
    description: 'Catálogo completo: indumentaria, sandalias y zuecos importados por docena cerrada. Talles y colores surtidos.',
    url:         `${env.APP_URL}/productos`,
    type:        'website',
    // Sin esto el og:image queda vacío — el openGraph de esta página
    // reemplaza (no fusiona) al del layout raíz. Mismo fallback que usa
    // el resto del sitio (ver fix reciente en /ubicacion).
    images: [{
      url:    `${env.APP_URL}/og-default.png?v=2`,
      width:  1200,
      height: 630,
      alt:    'Productos',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Productos',
    description: 'Catálogo completo: indumentaria, sandalias y zuecos importados por docena cerrada. Talles y colores surtidos.',
    images:      [`${env.APP_URL}/og-default.png`],
  },
};

export const revalidate = 60;

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; q?: string; categoria?: string }>;
}) {
  const params   = await searchParams;
  const pagina   = Math.max(1, parseInt(params.pagina ?? '1', 10));
  const busqueda = params.q?.trim() ?? '';
  const categoria = params.categoria?.trim() ?? '';
  const POR_PAGINA = 12;
  const offset     = (pagina - 1) * POR_PAGINA;
  const admin = createAdminClient();

  // Misma query base que usa la home (ver src/app/page.tsx) — mismo
  // criterio de "activo" + "venta_mayorista", misma paginación y filtros.
  let prodQuery = admin
    .from('products')
    .select('*', { count: 'exact' })
    .eq('activo', true)
    .eq('venta_mayorista', true)
    .order('destacado', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + POR_PAGINA - 1);

  if (busqueda) {
    prodQuery = prodQuery.or(
      `nombre.ilike.%${busqueda}%,descripcion_corta.ilike.%${busqueda}%`
    );
  }
  if (categoria) {
    prodQuery = prodQuery.eq('categoria', categoria);
  }

  const [{ data: products, count: totalProductos }, { data: categoriasRaw }] = await Promise.all([
    prodQuery,
    admin.from('products').select('categoria').eq('activo', true).eq('venta_mayorista', true),
  ]);

  const productList    = (products ?? []) as Product[];
  const totalPaginas   = Math.ceil((totalProductos ?? 0) / POR_PAGINA);
  const hayAnterior    = pagina > 1;
  const haySiguiente   = pagina < totalPaginas;
  const categoriasPresentes = new Set((categoriasRaw ?? []).map((r) => (r as { categoria: string }).categoria));
  const categoriasDisponibles = CATEGORIAS.filter((c) => categoriasPresentes.has(c.value));

  return (
    <>
      <PageHero
        eyebrow="Catálogo completo"
        title="Productos"
        description="Indumentaria, sandalias y zuecos importados por docena cerrada."
        icon={<ShoppingBag size={28} />}
      />

      <section className="mx-auto max-w-7xl px-4 py-12">
        {/* Barra de búsqueda + contador */}
        <AnimateIn className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <form action="/productos" method="GET" className="flex gap-2">
            <input name="q" defaultValue={busqueda} placeholder="Buscar productos…"
              className="input-base max-w-xs text-sm" />
            {busqueda && (
              <Link href="/productos" className="btn-ghost text-sm py-2 px-3">✕ Limpiar</Link>
            )}
          </form>
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
            {(busqueda || categoria) && (
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
            />

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
                {hayAnterior && (
                  <a
                    href={`/productos?pagina=${pagina - 1}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}${categoria ? `&categoria=${categoria}` : ''}`}
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
                          href={`/productos?pagina=${p}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}${categoria ? `&categoria=${categoria}` : ''}`}
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
                    href={`/productos?pagina=${pagina + 1}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}${categoria ? `&categoria=${categoria}` : ''}`}
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
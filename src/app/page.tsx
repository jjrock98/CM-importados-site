import Link from 'next/link';
import { env } from '@/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProductFilters } from '@/components/products/ProductFilters';
import { AnimateIn, StaggerGrid, StaggerItem } from '@/components/common/AnimateIn';
import { HeroVisual } from '@/components/home/HeroVisual';
import type { Product } from '@/types';
import type { Metadata } from 'next';
import { ShoppingBag, Truck, Shield, Star, ArrowRight, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Inicio – Venta mayorista por docena',
  description: 'Indumentaria, sandalias y zuecos importadas por docena cerrada. Talles y colores surtidos, envíos a todo el país.',
};

export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; q?: string }>;
}) {
  const params  = await searchParams;
  const pagina  = Math.max(1, parseInt(params.pagina ?? '1', 10));
  const busqueda = params.q?.trim() ?? '';
  const POR_PAGINA = 12;
  const offset     = (pagina - 1) * POR_PAGINA;
  const admin = createAdminClient();

  // Query base con búsqueda opcional
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

  const [{ data: products, count: totalProductos }, { data: rawContact }] = await Promise.all([
    prodQuery,
    admin
      .from('contact_info')
      .select('email,telefono,direccion,horario,instagram,whatsapp')
      .limit(1)
      .single(),
  ]);

  const productList    = (products ?? []) as Product[];
  const totalPaginas   = Math.ceil((totalProductos ?? 0) / POR_PAGINA);
  const hayAnterior    = pagina > 1;
  const haySiguiente   = pagina < totalPaginas;
  const contactInfo = rawContact as import('@/types').ContactInfo | null;

  const appUrl  = env.APP_URL;
  const tienda  = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  // ── JSON-LD estructurado: LocalBusiness + WebSite ─────────────────────────
  // Ayuda a Google a mostrar rich snippets (horario, dirección, reseñas, etc.)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'Store'],
    '@id': appUrl,
    name: tienda,
    url:  appUrl,
    description: `${tienda} — Venta de productos por packs. Media docena (6 uds) y Docena (12 uds). Envío a domicilio y retiro en local.`,
    ...(contactInfo?.email     && { email: contactInfo.email }),
    ...(contactInfo?.telefono  && { telephone: contactInfo.telefono }),
    ...(contactInfo?.direccion && { address: {
      '@type': 'PostalAddress',
      streetAddress: contactInfo.direccion,
      addressCountry: 'AR',
    }}),
    ...(contactInfo?.horario && { openingHours: contactInfo.horario }),
    ...(whatsapp && { sameAs: [`https://wa.me/${whatsapp}`] }),
    ...(contactInfo?.instagram && { sameAs: [contactInfo.instagram] }),
    priceRange: '$$',
    currenciesAccepted: 'ARS',
    paymentAccepted: 'Cash, Credit Card, Bank Transfer',
    image: `${appUrl}/og-default.png`,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Productos por pack',
    },
  };

  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda',
    url: env.APP_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${env.APP_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      {/* ✅ FIX: faltaba escapar '<' (riesgo de XSS si algún campo cargado
           desde /admin/configuracion llegara a contener '</script>') — mismo
           patrón ya usado en Breadcrumbs.tsx y productos/[slug]/page.tsx.
           Además, webSiteJsonLd estaba armado pero nunca se imprimía: sin
           esto, Google no puede ofrecer el buscador integrado (sitelinks
           searchbox) en los resultados de búsqueda. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd).replace(/</g, '\\u003c') }} />

      {/* Hero — navy de marca, con fondo animado atado al negocio real
          (sello de docena cerrada, chips de talles/colores) en vez de un
          bloque estático. Ver HeroVisual.tsx para el detalle. */}
      <section className="relative overflow-hidden bg-brand-800 text-white">
        <HeroVisual />

        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:py-24">
          <AnimateIn>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/70">
              Venta 100% mayorista · Envíos a toda Argentina
            </span>
          </AnimateIn>

          <AnimateIn delay={0.08}>
            <h1 className="mt-5 font-display text-3xl font-bold tracking-tight md:text-5xl">
              {tienda}: Eficiencia y Volumen en Indumentaria/Sandalias y Zuecos
            </h1>
          </AnimateIn>

          <AnimateIn delay={0.16}>
            <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto">
              Venta por docena cerrada — talles y colores surtidos, mejor precio por volumen.
            </p>
          </AnimateIn>

          <AnimateIn delay={0.24} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#catalogo"
              className="group inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 font-semibold text-brand-800 transition-all hover:bg-white/90"
            >
              <ShoppingBag size={18} />
              Explorar catálogo
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-white/30 px-6 py-2.5 font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                <MessageCircle size={18} /> Consultar por WhatsApp
              </a>
            )}
          </AnimateIn>
        </div>

        {/* Divisor angular — corta el bloque navy plano en vez de un borde recto */}
        <svg className="relative block w-full text-surface" viewBox="0 0 1440 48" preserveAspectRatio="none" style={{ height: '32px' }} aria-hidden="true">
          <path d="M0 48L1440 0V48H0Z" fill="currentColor" />
        </svg>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <StaggerGrid className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: Truck,       title: 'Envíos a todo el país',  desc: 'Calculamos el costo por CP' },
            { icon: Shield,      title: 'Compra segura',          desc: 'MP, tarjeta o transferencia' },
            { icon: Star,        title: 'Indumentaria, Sandalias y Zuecos importados', desc: 'Buen Precio-Calidad'   },
            { icon: ShoppingBag, title: 'Venta por docena',       desc: 'Talles y colores surtidos'  },
          ].map(({ icon: Icon, title, desc }) => (
            <StaggerItem key={title} className="group card-hover p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:bg-brand-900/40">
                <Icon size={20} />
              </div>
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs text-muted">{desc}</p>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>

      {/* Catalog with filters */}
      <section id="catalogo" className="mx-auto max-w-7xl px-4 pb-20">
        <AnimateIn className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-300">
              Catálogo general
            </span>
            <h2 className="font-display text-3xl font-bold mt-1">Productos</h2>
          </div>
        </AnimateIn>

        {/* Barra de búsqueda + contador */}
        <AnimateIn delay={0.06} className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <form action="/" method="GET" className="flex gap-2">
            <input name="q" defaultValue={busqueda} placeholder="Buscar productos…"
              className="input-base max-w-xs text-sm" />
            {busqueda && (
              <Link href="/" className="btn-ghost text-sm py-2 px-3">✕ Limpiar</Link>
            )}
          </form>
          <p className="text-sm text-muted">
            {totalProductos ?? 0} {(totalProductos ?? 0) === 1 ? 'producto' : 'productos'}
            {busqueda && <> para &ldquo;{busqueda}&rdquo;</>}
          </p>
        </AnimateIn>

        {productList.length === 0 ? (
          <AnimateIn className="rounded-2xl border border-dashed border-border py-20 text-center text-muted">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p>{busqueda ? `Sin resultados para "${busqueda}"` : 'No hay productos disponibles aún.'}</p>
            {busqueda && (
              <Link href="/" className="btn-secondary mt-4 text-sm px-4 py-2">Ver todo el catálogo</Link>
            )}
          </AnimateIn>
        ) : (
          <>
            <ProductFilters products={productList} />

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
              {hayAnterior && (
                <a
                  href={`/?pagina=${pagina - 1}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}`}
                  className="btn-secondary text-sm px-4 py-2 gap-1.5"
                >
                  ← Anterior
                </a>
              )}

              {/* Números de página */}
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
                        href={`/?pagina=${p}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}`}
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
                  href={`/?pagina=${pagina + 1}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}`}
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
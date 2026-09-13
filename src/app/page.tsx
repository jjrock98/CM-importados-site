import Link from 'next/link';
import { redirect } from 'next/navigation';
import { env } from '@/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProductCard } from '@/components/products/ProductCard';
import { AnimateIn, StaggerGrid, StaggerItem } from '@/components/common/AnimateIn';
import { HeroVisual } from '@/components/home/HeroVisual';
import { HeroSmoke } from '@/components/home/HeroSmoke';
import { ScrollToAnchor } from '@/components/common/ScrollToAnchor';
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
  searchParams: Promise<{ pagina?: string; q?: string; categoria?: string; scroll?: string }>;
}) {
  const params = await searchParams;

  // ✅ El catálogo completo (búsqueda, filtros, paginación) ahora vive en
  // /productos — la home solo muestra una vidriera de destacados. Un link
  // viejo compartido o ya indexado en Google con estos parámetros (p.ej.
  // "/?categoria=calzado") no debe perderse: lo mandamos a /productos con
  // los mismos filtros en vez de que la home simplemente los ignore.
  if (params.q || params.categoria || (params.pagina && params.pagina !== '1')) {
    const qs = new URLSearchParams();
    if (params.q)         qs.set('q', params.q);
    if (params.categoria) qs.set('categoria', params.categoria);
    if (params.pagina)    qs.set('pagina', params.pagina);
    redirect(`/productos?${qs.toString()}`);
  }

  const admin = createAdminClient();

  const [{ data: destacados }, { data: rawContact }] = await Promise.all([
    admin
      .from('products')
      .select('*')
      .eq('activo', true)
      .eq('venta_mayorista', true)
      .order('destacado', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8),
    admin
      .from('contact_info')
      .select('email,telefono,direccion,horario,instagram,whatsapp')
      .limit(1)
      .single(),
  ]);

  const productList = (destacados ?? []) as Product[];
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
      target: `${env.APP_URL}/buscar?q={search_term_string}`,
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

      {/* Soporte para links compartidos como /?scroll=catalogo — ver
          ScrollToAnchor.tsx para por qué hace falta esto además de
          href="#catalogo". */}
      <ScrollToAnchor targetId={params.scroll} />

      {/* Hero — navy de marca, con fondo animado atado al negocio real
          (sello de docena cerrada, chips de talles/colores) en vez de un
          bloque estático. Ver HeroVisual.tsx para el detalle.

          HeroSmoke agrega el efecto de humo/niebla (100% CSS, sin video
          ni imagen de por medio — ver HeroSmoke.tsx). */}
      <section className="relative overflow-hidden bg-brand-800 text-white">
        <HeroSmoke />
        <HeroVisual hideBackgroundEffects />

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

      {/* Vidriera — antes acá vivía el catálogo completo (búsqueda, filtros,
          paginación), duplicado casi 1:1 con /productos. Se dejó solo una
          muestra de destacados + link al catálogo completo, para no tener
          el mismo listado indexable en dos URLs distintas. */}
      <section id="catalogo" className="mx-auto max-w-7xl px-4 pb-20">
        <AnimateIn className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-300">
              Destacados
            </span>
            <h2 className="font-display text-3xl font-bold mt-1">Productos</h2>
          </div>
          <Link href="/productos" className="btn-secondary text-sm px-4 py-2 gap-1.5 shrink-0 inline-flex items-center">
            Ver catálogo completo <ArrowRight size={15} />
          </Link>
        </AnimateIn>

        {productList.length === 0 ? (
          <AnimateIn className="rounded-2xl border border-dashed border-border py-20 text-center text-muted">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p>No hay productos disponibles aún.</p>
          </AnimateIn>
        ) : (
          <>
            <StaggerGrid className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {productList.map((p) => (
                <StaggerItem key={p.id}>
                  <ProductCard product={p} />
                </StaggerItem>
              ))}
            </StaggerGrid>

            <AnimateIn className="mt-10 text-center">
              <Link href="/productos" className="btn-primary text-sm px-6 py-2.5 gap-1.5 inline-flex items-center">
                Ver catálogo completo <ArrowRight size={15} />
              </Link>
            </AnimateIn>
          </>
        )}
      </section>
    </>
  );
}
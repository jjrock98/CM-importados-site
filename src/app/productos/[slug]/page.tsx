import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/env';
import { RelatedProducts } from '@/components/products/RelatedProducts';
import { ProductPageClient } from '@/components/products/ProductPageClient';
import { ProductVideos } from '@/components/products/ProductVideos';
import { ProductModalTrigger } from '@/components/products/ProductModalTrigger';
import { VariantSelector } from '@/components/products/VariantSelector';
import { SimpleUnitBuyBox } from '@/components/products/SimpleUnitBuyBox';
import { ProductWhatsAppButton } from '@/components/products/ProductWhatsAppButton';
import { ProductShareButton } from '@/components/products/ProductShareButton';
import { ProductReviews } from '@/components/products/ProductReviews';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { formatPrice, cn } from '@/utils';
import { Package, ArrowLeft, Star } from 'lucide-react';
import type { Product, ProductReview } from '@/types';

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const admin = createAdminClient();
  const { data } = await admin.from('products').select('slug').eq('activo', true);
  return (data ?? []).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const admin      = createAdminClient();
  const { data: product } = await admin
    .from('products').select('*').eq('slug', slug).eq('activo', true).single();

  if (!product) return { title: 'Producto no encontrado' };

  const description = product.descripcion_corta ?? product.descripcion ?? `Comprá ${product.nombre} en packs de media docena o docena.`;
  const image       = product.imagenes?.[0];
  const appUrl      = env.APP_URL;

  // ✅ FIX: la imagen "con marca" (/api/og) se genera al vuelo y necesita
  // bajar la foto del producto desde Supabase para componerla — si esa
  // descarga tarda o falla, la generación entera falla y WhatsApp/redes
  // se quedan sin imagen (preview solo texto, que es lo que reportaste).
  // Ahora la foto real del producto va PRIMERO como og:image — es un
  // archivo estático ya servido por el CDN de Supabase, no depende de
  // nada más, así que siempre está disponible. La versión con marca y
  // precio queda como segunda opción para las plataformas que soportan
  // varias imágenes candidatas.
  const ogImageBranded = {
    url:    `${appUrl}/api/og?title=${encodeURIComponent(product.nombre)}&subtitle=${encodeURIComponent('Comprá por pack')}&price=${encodeURIComponent(
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(product.precio_media_docena ?? product.precio_docena)
    )}${image ? `&image=${encodeURIComponent(image)}` : ''}`,
    width:  1200,
    height: 630,
    alt:    product.nombre,
  };
  const ogImages = image
    ? [{ url: image, width: 1200, height: 1200, alt: product.nombre }, ogImageBranded]
    : [ogImageBranded];

  return {
    title:      product.nombre,
    description,
    alternates: { canonical: `${appUrl}/productos/${slug}` },
    openGraph: {
      title:       product.nombre,
      description,
      url:         `${appUrl}/productos/${slug}`,
      type:        'website',
      images:      ogImages,
    },
    twitter: {
      card:        'summary_large_image',
      title:       product.nombre,
      description,
      images: [image ?? ogImageBranded.url],
    },
  };
}

export const revalidate = 60;

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: product } = await admin
    .from('products').select('*').eq('slug', slug).eq('activo', true).single();

  if (!product) notFound();

  const p = product as Product;

  // ✅ Traer variantes (talla/color) con stock real, si el producto las tiene
  let variants: import('@/types').ProductVariant[] = [];
  if (p.venta_minorista) {
    const { data: variantData } = await admin
      .from('product_variants')
      .select('*')
      .eq('product_id', p.id)
      .eq('activo', true)
      .order('talla').order('color');
    variants = variantData ?? [];
  }

  const maxMediaDocena = Math.floor(p.stock_unidades / 6);
  const maxDocena      = Math.floor(p.stock_unidades / 12);

  // ✅ Google marca como "falta el campo description" cuando descripcion Y
  // descripcion_corta están vacíos en el admin — pasa seguido porque
  // cargar una descripción a mano por cada producto no escala. En vez de
  // depender de que siempre se complete a mano, si ambos están vacíos se
  // arma una descripción real (no inventada: son los mismos datos que ya
  // se muestran en la página) a partir de talles/colores/tipo de venta.
  const descripcionFallback = () => {
    const partes: string[] = [];
    if (p.talles?.length)  partes.push(`Talles ${p.talles.join(', ')}`);
    if (p.colores?.length) partes.push(`colores ${p.colores.join(', ')}`);
    const detalle = partes.length ? p.nombre + ' — ' + partes.join(', ') + '.' : `${p.nombre}.`;
    const venta = p.venta_mayorista
      ? ` Venta por pack: ${p.precio_media_docena != null ? 'media docena o docena.' : 'docena.'}`
      : ' Venta por unidad.';
    return detalle + venta;
  };
  const jsonLdDescription = p.descripcion ?? p.descripcion_corta ?? descripcionFallback();

  // ✅ Reseñas reales y aprobadas de este producto. Solo con esto en mano
  // se arma aggregateRating/review más abajo — nunca con datos inventados
  // (Google penaliza structured data falseado quitando TODOS los rich
  // results del sitio, no solo el de estrellas).
  const { data: reviewsData } = await admin
    .from('product_reviews')
    .select('*')
    .eq('product_id', p.id)
    .eq('aprobado', true)
    .order('created_at', { ascending: false });
  const reviews = (reviewsData ?? []) as ProductReview[];
  const ratingPromedio = reviews.length
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        p.nombre,
    description: jsonLdDescription,
    image:       p.imagenes,
    sku:         p.id,
    mpn:         p.id,
    // No manejamos GTIN (productos importados sin código de barras propio),
    // así que declaramos la marca de la tienda como identificador.
    brand: { '@type': 'Brand', name: process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda' },
    // Solo se agregan si hay AL MENOS UNA reseña real aprobada — sin esto,
    // Google marca "falta aggregateRating/review" pero es una advertencia
    // opcional, no un error; declarar un promedio sin reseñas de verdad
    // sería structured data spam.
    ...(reviews.length > 0 ? {
      aggregateRating: {
        '@type':      'AggregateRating',
        ratingValue:  Number(ratingPromedio.toFixed(2)),
        reviewCount:  reviews.length,
      },
      review: reviews.map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.nombre_cliente },
        datePublished: r.created_at,
        reviewBody: r.comentario,
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      })),
    } : {}),
    offers: [
      // Media docena es opcional: solo se agrega como offer si el producto la tiene cargada
      ...(p.precio_media_docena != null ? [{
        '@type':       'Offer',
        name:          'Media docena (6 unidades)',
        price:          p.precio_media_docena,
        priceCurrency: 'ARS',
        availability:  p.stock_unidades >= 6
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda' },
        // Política real: cambios dentro de los 3 días de recibido. El
        // método de devolución es flexible (correo/transporte, en persona,
        // o retiro por cadete) — no hay un valor exacto de schema.org para
        // "retiro con cadete", así que se lo agrupa bajo ReturnByMail
        // (cualquier variante en la que el producto viaja de vuelta, sin
        // que el cliente vaya a un local). Los gastos de envío de la
        // devolución dependen del motivo: gratis si es defecto de fábrica,
        // a cargo del cliente si es cambio sin defecto — por eso se usan
        // los campos específicos por motivo en vez de un "returnFees"
        // único, que no podría representar esta diferencia.
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 3,
          applicableCountry: 'AR',
          refundType: 'https://schema.org/ExchangeRefund',
          returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
          // returnFees = caso general (motivo del cliente, no defecto):
          // lo paga el cliente. itemDefectReturnFees lo sobreescribe a
          // gratis específicamente cuando el motivo es un defecto de
          // fábrica. Se declaran los tres porque el validador de Google
          // chequea "returnFees" de forma puntual y no lo da por cubierto
          // solo con los campos específicos por motivo.
          returnFees: 'https://schema.org/ReturnShippingFees',
          itemDefectReturnFees: 'https://schema.org/FreeReturn',
          customerRemorseReturnFees: 'https://schema.org/ReturnShippingFees',
        },
        // Sin shippingDetails: el envío se coordina manualmente (WhatsApp,
        // chat en vivo o personalmente) y su costo varía — declarar acá
        // "envío gratis" o un monto fijo sería inexacto para Google y
        // podría mostrar información engañosa en los resultados de
        // búsqueda.
      }] : []),
      {
        '@type':       'Offer',
        name:          'Docena (12 unidades)',
        price:          p.precio_docena,
        priceCurrency: 'ARS',
        availability:  p.stock_unidades >= 12
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda' },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 3,
          applicableCountry: 'AR',
          refundType: 'https://schema.org/ExchangeRefund',
          returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
          returnFees: 'https://schema.org/ReturnShippingFees',
          itemDefectReturnFees: 'https://schema.org/FreeReturn',
          customerRemorseReturnFees: 'https://schema.org/ReturnShippingFees',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // ✅ JSON.stringify ya escapa comillas/barras dentro de los valores
        // (nombres de producto con " o / no rompen el JSON). El .replace
        // adicional evita que un nombre que contenga literalmente
        // "</script>" corte la etiqueta antes de tiempo — hardening
        // estándar al inyectar JSON dentro de un <script> con
        // dangerouslySetInnerHTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb visual + JSON-LD BreadcrumbList estructurado */}
        <Breadcrumbs
          items={[
            { name: 'Inicio', url: '/' },
            { name: 'Productos', url: '/#catalogo' },
            { name: p.nombre, url: `/productos/${p.slug}` },
          ]}
        />

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <ProductPageClient images={p.imagenes} nombre={p.nombre} />
            <ProductVideos videos={p.videos ?? []} nombre={p.nombre} />
          </div>

          {/* Info */}
          <div className="space-y-6">
            {p.destacado && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-400">
                <Star size={12} fill="currentColor" /> Producto destacado
              </span>
            )}

            <h1 className="font-display text-3xl font-bold leading-tight">{p.nombre}</h1>

            {p.descripcion_corta && (
              <p className="text-lg text-muted leading-relaxed">{p.descripcion_corta}</p>
            )}

            {/* Pack prices — solo si el producto vende por packs mayoristas.
                Media docena es opcional: solo se muestra si el producto la tiene cargada. */}
            {p.venta_mayorista && (
              <div className={cn('grid gap-3', p.precio_media_docena != null ? 'grid-cols-2' : 'grid-cols-1')}>
                {[
                  ...(p.precio_media_docena != null
                    ? [{ label: 'Media docena', unidades: 6, precio: p.precio_media_docena, maxPacks: maxMediaDocena }]
                    : []),
                  { label: 'Docena',       unidades: 12, precio: p.precio_docena,       maxPacks: maxDocena      },
                ].map(({ label, unidades, precio, maxPacks }) => (
                  <div key={label} className="card p-4 text-center">
                    <p className="text-xs text-muted mb-1">{label}</p>
                    <p className="text-xs text-muted mb-2">{unidades} unidades</p>
                    <p className="text-xl font-bold text-brand-600">{formatPrice(precio)}</p>
                    <p className="text-xs text-muted mt-1">
                      {maxPacks > 0 ? `Hasta ${maxPacks} packs` : '❌ Sin stock'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Precio escalonado por volumen */}
            {p.venta_mayorista && p.precio_tiers?.length > 0 && (
              <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-950/10 p-4">
                <p className="text-sm font-semibold mb-2">💰 Precio por volumen</p>
                <div className="space-y-1">
                  {[...p.precio_tiers].sort((a, b) => a.min_docenas - b.min_docenas).map((t) => (
                    <div key={t.min_docenas} className="flex justify-between text-sm">
                      <span className="text-muted">{t.min_docenas}+ docenas</span>
                      <span className="font-semibold text-brand-600">{formatPrice(t.precio_docena)} c/u</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock indicator — solo relevante para el flujo de packs (mayorista) */}
            {p.venta_mayorista && (
              <div className="flex items-center gap-3 text-sm">
                <Package size={16} className="text-muted" />
                <span className="text-muted">Stock disponible:</span>
                <span className={`font-semibold ${
                  p.stock_unidades === 0 ? 'text-red-500' :
                  p.stock_unidades < 12  ? 'text-yellow-600' : 'text-green-600'}`}>
                  {p.stock_unidades} unidades
                </span>
              </div>
            )}

            {/* ✅ Talles y colores orientativos — aplica a docena y media docena
                 por igual (es una sola composición de fábrica, no cambia según
                 el tamaño del pack). Se muestra siempre que el producto tenga
                 venta mayorista, independientemente de si además tiene variantes
                 cargadas para alimentar la curva automática: esta guía y el
                 selector de talle exacto (más abajo) cumplen roles distintos. */}
            {p.venta_mayorista && ((p.colores?.length ?? 0) > 0 || (p.talles?.length ?? 0) > 0) && (
              <div className="rounded-xl border border-border bg-surface-2/50 p-4">
                <p className="text-sm font-semibold mb-1">🏭 Así viene surtida de fábrica</p>
                <p className="text-xs text-muted mb-3">
                  Guía orientativa de los talles y colores que trae la docena y la curva de este producto.
                  La composición viene definida de fábrica — no se puede elegir combinación exacta al comprar por pack.
                </p>
                {(p.colores?.length ?? 0) > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted mb-1.5">Colores</p>
                    <div className="flex flex-wrap gap-2">
                      {p.colores!.map((c) => <span key={c} className="badge bg-surface text-sm px-3 py-1">{c}</span>)}
                    </div>
                  </div>
                )}
                {(p.talles?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-1.5">Talles</p>
                    <div className="flex flex-wrap gap-2">
                      {p.talles!.map((t) => <span key={t} className="badge bg-surface text-sm px-3 py-1">{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ✅ Selector interactivo de talla/color con stock real — solo
                 para venta minorista (elegir y comprar una unidad exacta).
                 Un producto mayorista puro no debe mostrar este selector aunque
                 tenga variantes cargadas: esas variantes solo alimentan la curva
                 automática del pack, no implican que el cliente pueda elegirlas. */}
            {p.venta_minorista && variants.length > 0 ? (
              <VariantSelector product={p} initialVariants={variants} />
            ) : p.venta_minorista ? (
              <SimpleUnitBuyBox product={p} />
            ) : null}

            {/* ✅ Fixed: usa ProductModalTrigger, no ProductModal */}
            {p.venta_mayorista && (
              <ProductModalTrigger product={p} triggerLabel="Elegir pack y agregar al carrito" />
            )}

            <ProductWhatsAppButton
              productName={p.nombre}
              productUrl={`${env.APP_URL}/productos/${p.slug}`}
            />

            <ProductShareButton
              productName={p.nombre}
              productUrl={`${env.APP_URL}/productos/${p.slug}`}
            />

            {/* Description */}
            {p.descripcion && (
              <div className="border-t border-border pt-5">
                <p className="text-sm font-medium mb-2">Descripción</p>
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{p.descripcion}</p>
              </div>
            )}

            <Link href="/productos" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
              <ArrowLeft size={14} /> Ver todos los productos
            </Link>
          </div>
        </div>

        {/* Reseñas reales de clientes con compra verificada */}
        <ProductReviews productId={p.id} initialReviews={reviews} />

        {/* Related products */}
        <RelatedProducts currentProductId={p.id} categoria={p.categoria} />
      </div>
    </>
  );
}
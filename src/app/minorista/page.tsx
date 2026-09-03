import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { MinoristaGrid } from '@/components/minorista/MinoristaGrid';
import { ShoppingBag, Tag, Truck, Package } from 'lucide-react';
import type { Product } from '@/types';

export const metadata: Metadata = {
  title: 'Venta Minorista — Comprá por unidad',
  description: 'Comprá nuestros productos por unidad individual. Ideal para compras personales sin necesidad de adquirir un pack completo.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL}/minorista` },
  openGraph: {
    title:       'Venta Minorista — Comprá por unidad',
    description: 'Sin necesidad de pack — elegí exactamente lo que necesitás.',
    type:        'website',
  },
};

export const revalidate = 60;

export default async function MinoristaPage({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string }>;
}) {
  const { buscar } = await searchParams;
  const admin = createAdminClient();
  const { data: products } = await admin
    .from('products')
    .select('*')
    .eq('activo', true)
    .eq('venta_minorista', true)
    .order('destacado', { ascending: false })
    .order('nombre');

  const productList = (products ?? []) as Product[];

  // ✅ Traer todas las variantes activas de estos productos en 1 sola query
  // (en vez de N queries, una por card) y adjuntarlas a cada producto.
  if (productList.length > 0) {
    const { data: variants } = await admin
      .from('product_variants')
      .select('*')
      .in('product_id', productList.map((p) => p.id))
      .eq('activo', true)
      .gt('stock_unidades', 0)
      .order('talla').order('color');

    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants ?? []) {
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(v);
      variantsByProduct.set(v.product_id, list);
    }
    for (const p of productList) {
      p.variants = variantsByProduct.get(p.id) ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Hero banner */}
      <div className="mb-10 rounded-2xl bg-gradient-to-br from-brand-50 to-amber-50 dark:from-brand-950/30 dark:to-amber-950/20 border border-brand-200 dark:border-brand-800 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-brand-500 px-3 py-0.5 text-xs font-bold text-white">NUEVO</span>
              <Tag size={16} className="text-brand-600" />
              <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">Venta Minorista</span>
            </div>
            <h1 className="font-display text-3xl font-bold md:text-4xl">Comprá por unidad</h1>
            <p className="mt-2 max-w-lg text-muted">
              Sin necesidad de comprar el pack completo. Elegí exactamente la cantidad que necesitás,
              desde {Math.min(...productList.map(p => p.stock_minorista_min || 1))} unidad en adelante.
            </p>
          </div>
          <Link href="/" className="btn-secondary self-start gap-2 whitespace-nowrap md:self-center">
            <Package size={15} /> Ver packs mayoristas
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Tag,         text: 'Precio por unidad — sin compromiso de pack' },
            { icon: Truck,       text: 'Mismo envío que los packs — domicilio o retiro' },
            { icon: ShoppingBag, text: 'Mezclá unidades y packs en el mismo carrito' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-2 text-sm">
              <Icon size={14} className="mt-0.5 shrink-0 text-brand-500" />
              <span className="text-muted">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {productList.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border text-muted">
          <ShoppingBag size={48} className="opacity-20" />
          <p className="font-medium">No hay productos en venta minorista por el momento.</p>
          <Link href="/" className="btn-primary mt-2">Ver catálogo completo</Link>
        </div>
      ) : (
        <MinoristaGrid products={productList} initialSearch={buscar} />
      )}
    </div>
  );
}

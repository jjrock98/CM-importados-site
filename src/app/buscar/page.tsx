import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/products/ProductCard';
import type { Product } from '@/types';
import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import Link from 'next/link';

interface Props {
  searchParams: { q?: string }
}

export function generateMetadata({ searchParams }: Props): Metadata {
  const q = searchParams.q?.trim();
  return {
    title:       q ? `Resultados para "${q}"` : 'Buscar productos',
    description: q ? `Encontrá "${q}" en nuestra tienda. Comprá por packs de media docena o docena.` : 'Buscá productos en nuestra tienda.',
    robots:      { index: !!q, follow: true },
  };
}

export const dynamic = 'force-dynamic';

export default async function BuscarPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? '';

  let products: Product[] = [];

  if (q.length >= 2) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('activo', true)
      .eq('venta_mayorista', true)
      .or(
        `nombre.ilike.%${q}%,` +
        `descripcion.ilike.%${q}%,` +
        `descripcion_corta.ilike.%${q}%`
      )
      .order('destacado', { ascending: false })
      .order('stock_unidades', { ascending: false })
      .limit(40);

    products = (data ?? []) as Product[];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Search bar */}
      <form action="/buscar" method="GET" className="mb-8">
        <div className="relative max-w-xl">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar productos…"
            className="input-base pl-12 py-3 text-base"
            autoFocus={!q}
            minLength={2}
            maxLength={100}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1.5 px-4 text-sm"
          >
            Buscar
          </button>
        </div>
      </form>

      {/* Results */}
      {!q && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Search size={48} className="text-muted opacity-20" />
          <p className="text-muted">Escribí al menos 2 caracteres para buscar.</p>
          <Link href="/" className="btn-secondary text-sm">Ver todos los productos</Link>
        </div>
      )}

      {q && q.length < 2 && (
        <p className="text-muted text-sm">La búsqueda debe tener al menos 2 caracteres.</p>
      )}

      {q && q.length >= 2 && (
        <>
          <div className="mb-5 flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">
              {products.length > 0
                ? <>Resultados para <span className="text-brand-600">&ldquo;{q}&rdquo;</span></>
                : <>Sin resultados para <span className="text-brand-600">&ldquo;{q}&rdquo;</span></>}
            </h1>
            {products.length > 0 && (
              <span className="badge bg-surface-2 text-muted">
                {products.length} producto{products.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <Search size={48} className="text-muted opacity-20" />
              <div>
                <p className="text-muted mb-2">No encontramos productos para &ldquo;{q}&rdquo;.</p>
                <p className="text-sm text-muted">Probá con otras palabras o</p>
              </div>
              <div className="flex gap-3">
                <Link href="/" className="btn-primary text-sm">Ver todo el catálogo</Link>
                <Link href="/contacto" className="btn-secondary text-sm">Consultar stock</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

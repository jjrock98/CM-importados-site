import { createClient } from '@/lib/supabase/server';
import { ProductCard } from './ProductCard';
import type { Product } from '@/types';

interface Props { currentProductId: string; categoria: string }

// Fisher–Yates — para que "También te puede interesar" no muestre siempre
// los mismos 4 destacados, sino una selección al azar en cada revalidación
// de la página (revalidate = 60 en productos/[slug]/page.tsx).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function RelatedProducts({ currentProductId, categoria }: Props) {
  const supabase = await createClient();

  // ✅ FIX: antes mostraba siempre los mismos 4 productos "destacados" de
  // todo el catálogo, sin relación con lo que se está viendo. Ahora trae
  // productos de la MISMA categoría, al azar. Se piden hasta 16 para
  // barajar y elegir 4 distintos cada vez (si se pidieran solo 4 con
  // .limit(4), sería siempre el mismo recorte fijo de la tabla).
  const { data: mismaCategoria } = await supabase
    .from('products')
    .select('*')
    .eq('activo', true)
    .eq('categoria', categoria)
    .neq('id', currentProductId)
    .limit(16);

  let products = shuffle((mismaCategoria ?? []) as Product[]).slice(0, 4);

  // Si la categoría no tiene 4 productos para mostrar, se completa con
  // otras categorías en vez de dejar la sección con menos de 4 (o vacía).
  if (products.length < 4) {
    const yaElegidos = [currentProductId, ...products.map((p) => p.id)];
    const { data: otras } = await supabase
      .from('products')
      .select('*')
      .eq('activo', true)
      .not('id', 'in', `(${yaElegidos.join(',')})`)
      .limit(16);
    const relleno = shuffle((otras ?? []) as Product[]).slice(0, 4 - products.length);
    products = [...products, ...relleno];
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border pt-12">
      <h2 className="font-display text-2xl font-bold mb-6">También te puede interesar</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
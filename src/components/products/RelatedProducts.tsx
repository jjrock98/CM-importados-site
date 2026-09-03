import { createClient } from '@/lib/supabase/server';
import { ProductCard } from './ProductCard';
import type { Product } from '@/types';

interface Props { currentProductId: string }

export async function RelatedProducts({ currentProductId }: Props) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('activo', true)
    .neq('id', currentProductId)
    .limit(4)
    .order('destacado', { ascending: false });

  const products = (data ?? []) as Product[];
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

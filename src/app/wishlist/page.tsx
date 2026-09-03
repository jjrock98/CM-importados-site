import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProductCard } from '@/components/products/ProductCard';
import { Heart } from 'lucide-react';
import type { Product } from '@/types';

export const metadata = { title: 'Mi Wishlist' };

export default async function WishlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/wishlist');

  const { data } = await supabase
    .from('wishlists')
    .select('products(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // ✅ Extraer correctamente cada producto anidado y tipar como Product
  const products: Product[] = (data ?? [])
    .flatMap((row) => {
      const p = row.products;
      return Array.isArray(p) ? p : p ? [p] : [];
    })
    .filter(Boolean) as Product[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold mb-8 flex items-center gap-3">
        <Heart size={28} className="text-red-500" fill="currentColor" /> Mi Wishlist
      </h1>

      {products.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
          <Heart size={48} className="opacity-20" />
          <p>Todavía no guardaste productos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

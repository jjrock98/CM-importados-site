import { createAdminClient } from '@/lib/supabase/admin';
import { AdminProductsClient } from '@/components/admin/AdminProductsClient';
import type { Product } from '@/types';

export const metadata = { title: 'Productos – Admin' };
export const revalidate = 0;

interface Props {
  // ✅ FIX: en Next.js 15+/16, `searchParams` en un Server Component es una
  // Promise — accederla como objeto plano (`searchParams.filter`) devolvía
  // siempre `undefined`, así que el link "Ver productos →" de Stock bajo
  // (?filter=lowstock) nunca llegaba a aplicarse y se mostraban todos los
  // productos.
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminProductosPage({ searchParams }: Props) {
  const { filter } = await searchParams;
  const admin = createAdminClient();
  const { data: products } = await admin
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Gestión de Productos</h1>
      <AdminProductsClient
        initialProducts={(products ?? []) as Product[]}
        initialLowStockFilter={filter === 'lowstock'}
      />
    </div>
  );
}
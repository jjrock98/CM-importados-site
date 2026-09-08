import { createAdminClient } from '@/lib/supabase/admin';
import { AdminReviewsClient } from '@/components/admin/AdminReviewsClient';

export const metadata = { title: 'Reseñas – Admin' };
export const revalidate = 0;

export default async function AdminResenasPage() {
  const admin = createAdminClient();
  const { data: reviews } = await admin
    .from('product_reviews')
    .select('*, products(nombre, slug)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Reseñas de Clientes</h1>
      <AdminReviewsClient initialReviews={reviews ?? []} />
    </div>
  );
}
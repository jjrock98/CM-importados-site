import { createAdminClient } from '@/lib/supabase/admin';
import { AdminOrdersClient } from '@/components/admin/AdminOrdersClient';
import type { Order } from '@/types';

export const metadata = { title: 'Pedidos – Admin' };
export const revalidate = 0;

export default async function AdminPedidosPage() {
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from('orders')
    .select('*, order_items(*, products(nombre))')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Gestión de Pedidos</h1>
      <AdminOrdersClient initialOrders={(orders ?? []) as Order[]} />
    </div>
  );
}

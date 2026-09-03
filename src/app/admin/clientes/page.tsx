import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminClientesClient } from '@/components/admin/AdminClientesClient';

export const metadata: Metadata = { title: 'Clientes — Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminClientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/admin/clientes');

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') redirect('/');

  const admin = createAdminClient();

  // Clientes registrados con stats de compras
  const { data: clients } = await admin
    .from('profiles')
    .select(`
      id, nombre, email, telefono, ciudad, rol,
      created_at, updated_at
    `)
    .eq('rol', 'cliente')
    .order('created_at', { ascending: false });

  // Órdenes por usuario (para calcular stats)
  const { data: orderStats } = await admin
    .from('orders')
    .select('user_id, total, estado, created_at')
    .not('user_id', 'is', null)
    .neq('estado', 'cancelado');

  // Calcular stats por cliente
  type ClientStat = {
    totalPedidos: number;
    totalGastado: number;
    ultimoPedido: string | null;
  };
  const statsMap = new Map<string, ClientStat>();
  for (const order of orderStats ?? []) {
    if (!order.user_id) continue;
    const cur = statsMap.get(order.user_id) ?? { totalPedidos: 0, totalGastado: 0, ultimoPedido: null };
    cur.totalPedidos += 1;
    cur.totalGastado += Number(order.total);
    if (!cur.ultimoPedido || order.created_at > cur.ultimoPedido) {
      cur.ultimoPedido = order.created_at;
    }
    statsMap.set(order.user_id, cur);
  }

  // Pedidos de invitados (user_id = null)
  const { count: pedidosInvitados } = await admin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .is('user_id', null);

  const clientList = (clients ?? []).map((c) => ({
    ...c,
    ...(statsMap.get(c.id) ?? { totalPedidos: 0, totalGastado: 0, ultimoPedido: null }),
  }));

  // Métricas generales
  const totalClientes  = clientList.length;
  const clientesActivos = clientList.filter((c) => c.totalPedidos > 0).length;
  const totalGastado   = clientList.reduce((a, c) => a + c.totalGastado, 0);
  const ticketPromedio = clientesActivos > 0
    ? totalGastado / clientList.reduce((a, c) => a + c.totalPedidos, 0)
    : 0;

  return (
    <AdminClientesClient
      clients={clientList}
      metrics={{
        totalClientes,
        clientesActivos,
        totalGastado,
        ticketPromedio,
        pedidosInvitados: pedidosInvitados ?? 0,
      }}
    />
  );
}

import { createAdminClient } from '@/lib/supabase/admin';
import { AdminMensajesClient } from '@/components/admin/AdminMensajesClient';
import type { ContactMessage } from '@/types';

export const metadata = { title: 'Mensajes – Admin' };
export const revalidate = 0;

export default async function AdminMensajesPage() {
  const admin = createAdminClient();
  const { data: messages } = await admin
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Mensajes de Contacto</h1>
      <AdminMensajesClient initialMessages={(messages ?? []) as ContactMessage[]} />
    </div>
  );
}

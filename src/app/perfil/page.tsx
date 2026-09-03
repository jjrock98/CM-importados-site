import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileClient } from '@/components/profile/ProfileClient';
import type { Profile } from '@/types';

export const metadata = { title: 'Mi perfil' };
export const dynamic  = 'force-dynamic';

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/perfil');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: ordersCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold mb-2">Mi perfil</h1>
      <p className="text-muted mb-8">Gestioná tus datos personales y de entrega.</p>
      <ProfileClient
        profile={profile as Profile}
        ordersCount={(ordersCount as unknown as number) ?? 0}
      />
    </div>
  );
}

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { AdminNotifications } from '@/components/admin/AdminNotifications';

export const metadata = { title: 'Panel de administración' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/admin');

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') redirect('/');

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <div className="flex flex-1 flex-col">
        {/* Mobile nav */}
        <AdminMobileNav />

        {/* Desktop top bar with notifications */}
        <div className="hidden md:flex items-center justify-end gap-2 border-b border-border bg-surface px-6 py-2">
          <AdminNotifications />
        </div>

        <main className="flex-1 overflow-auto bg-surface-2 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import { createAdminClient } from '@/lib/supabase/admin';
import { AdminConfigClient } from '@/components/admin/AdminConfigClient';

export const metadata = { title: 'Configuración – Admin' };
export const revalidate = 0;

export default async function AdminConfiguracionPage() {
  const admin = createAdminClient();

  const [
    { data: bankInfo },
    { data: contactInfo },
    { data: locationInfo },
    { data: siteSettings },
  ] = await Promise.all([
    admin.from('bank_info').select('*').single(),
    admin.from('contact_info').select('*').single(),
    admin.from('location_info').select('*').single(),
    admin.from('site_settings').select('*'),
  ]);

  const settingsMap = Object.fromEntries(
    (siteSettings ?? []).map((s: { clave: string; valor: string | null }) => [s.clave, s.valor ?? ''])
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Configuración General</h1>
      <AdminConfigClient
        initialBank={bankInfo}
        initialContact={contactInfo}
        initialLocation={locationInfo}
        initialSettings={settingsMap}
      />
    </div>
  );
}

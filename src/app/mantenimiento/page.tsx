import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'En mantenimiento',
  robots: { index: false },
};

// ✅ Server Component que lee el mensaje de mantenimiento
// dinámicamente desde site_settings en Supabase.
// (en lugar de leer una variable de entorno estática)
export default async function MantenimientoPage() {
  let mensaje = 'Estamos realizando mejoras. Volvemos pronto.';
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('site_settings')
      .select('valor')
      .eq('clave', 'mantenimiento_mensaje')
      .single();
    if (data?.valor) mensaje = data.valor;
  } catch { /* fallback al mensaje por defecto */ }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl">🔧</div>
      <h1 className="font-display text-3xl font-bold md:text-4xl">Estamos mejorando</h1>
      <p className="text-muted text-lg max-w-md">{mensaje}</p>
      <p className="text-sm text-muted">Disculpá las molestias.</p>
    </div>
  );
}

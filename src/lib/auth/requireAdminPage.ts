import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Chequeo de admin + segundo factor para PÁGINAS de /admin (server components).
 *
 * Por qué hace falta: varias páginas del panel leen datos con la service role
 * (createAdminClient) y hasta ahora dependían solo de proxy.ts y del layout.
 * En el App Router el layout y la página se renderizan en paralelo: un
 * redirect() del layout NO frena que la página ejecute sus consultas. Esto
 * pone el mismo criterio que checkAdmin() (verifyAdmin.ts) en la propia
 * página, antes de tocar datos.
 *
 * allowEnrollment: solo para /admin/configuracion. Con ADMIN_REQUIRE_MFA=true,
 * un admin que todavía no activó 2FA tiene que poder entrar ahí a activarlo;
 * si no, quedaría en un bucle sin salida.
 */
export async function requireAdminPage(
  fromPath: string,
  opts: { allowEnrollment?: boolean } = {},
): Promise<User> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?redirect=${encodeURIComponent(fromPath)}`);

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') redirect('/');

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const hasSecondFactor = aal?.nextLevel === 'aal2';
  const passedSecondFactor = aal?.currentLevel === 'aal2';

  if (hasSecondFactor && !passedSecondFactor) {
    redirect(`/auth/mfa?redirect=${encodeURIComponent(fromPath)}`);
  }
  if (process.env.ADMIN_REQUIRE_MFA === 'true' && !passedSecondFactor && !opts.allowEnrollment) {
    redirect('/admin/configuracion');
  }

  return user;
}
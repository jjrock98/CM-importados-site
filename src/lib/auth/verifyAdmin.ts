import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Verificación de admin compartida por TODAS las rutas /api/admin/*.
 *
 * Antes cada ruta tenía su propia copia que solo miraba `rol === 'admin'`.
 * Eso dejaba un hueco: el proxy exige el segundo factor (aal2) para las
 * PÁGINAS de /admin, pero no corre sobre /api/admin/*, así que una sesión que
 * solo pasó la contraseña (aal1) podía llamar igual a toda la API del panel.
 *
 * Reglas:
 *  1. Hay sesión válida (getUser() confirma contra el servidor de Auth).
 *  2. profiles.rol === 'admin'.
 *  3. Segundo factor: si la cuenta tiene 2FA activado (nextLevel === 'aal2'),
 *     la sesión tiene que estar en aal2. Mismo criterio que proxy.ts.
 *  4. Opcional: ADMIN_REQUIRE_MFA=true exige 2FA a TODO admin, aunque nunca
 *     lo haya activado. Dejarlo apagado hasta que cada admin lo haya
 *     activado en /admin/configuración; si no, queda sin acceso a la API.
 */

export type AdminCheck =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; error: string };

const REQUIRE_MFA_FOR_ALL = process.env.ADMIN_REQUIRE_MFA === 'true';

export async function checkAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'No autenticado' };

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') {
    return { ok: false, status: 403, error: 'No autorizado' };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const hasSecondFactor = aal?.nextLevel === 'aal2';
  const passedSecondFactor = aal?.currentLevel === 'aal2';

  if (hasSecondFactor && !passedSecondFactor) {
    return { ok: false, status: 403, error: 'Se requiere verificación en dos pasos' };
  }
  if (REQUIRE_MFA_FOR_ALL && !passedSecondFactor) {
    return { ok: false, status: 403, error: 'Activá la verificación en dos pasos para usar el panel' };
  }

  return { ok: true, user };
}

/** Contrato histórico de las rutas: devuelve el usuario admin o null. */
export async function verifyAdmin(): Promise<User | null> {
  const result = await checkAdmin();
  return result.ok ? result.user : null;
}
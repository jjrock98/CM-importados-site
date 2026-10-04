import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/safeRedirect';

/**
 * Cierre de sesión por inactividad de CLIENTES, iniciado desde el navegador
 * (UserIdleTimer). Misma lógica que proxy.ts → enforceIdleTimeout:
 *  - si la página donde estaba es privada (AUTH_REQUIRED_ROUTES) →
 *    /auth/login con el aviso de "sesión cerrada por inactividad";
 *  - si es pública → se cierra la sesión y sigue ahí como invitado.
 *
 * Borra las cookies de actividad (httpOnly: el navegador no puede) para que
 * el proxy no cierre otra vez la próxima sesión por una marca vieja.
 */
export const dynamic = 'force-dynamic';

// Mantener igual que AUTH_REQUIRED_ROUTES en proxy.ts
const PRIVATE_ROUTES = ['/mis-pedidos', '/wishlist', '/completar-perfil', '/perfil'];

export async function GET(request: Request) {
  const url  = new URL(request.url);
  const next = safeRedirectPath(url.searchParams.get('next'), '/');

  const supabase = await createClient();
  await supabase.auth.signOut();

  const isPrivate = PRIVATE_ROUTES.some((r) => next.startsWith(r));
  let dest: URL;
  if (isPrivate) {
    dest = new URL('/auth/login', url.origin);
    dest.searchParams.set('redirect', next);
    dest.searchParams.set('expired', '1');
  } else {
    dest = new URL(next, url.origin);
  }

  const res = NextResponse.redirect(dest);
  res.cookies.delete('user_last_activity');
  res.cookies.delete('admin_last_activity');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
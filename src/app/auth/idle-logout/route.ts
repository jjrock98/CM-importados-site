import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Cierre de sesión por inactividad iniciado desde el navegador
 * (AdminIdleTimer). Cierra la sesión de verdad (revoca el refresh token),
 * borra las cookies de actividad que usa proxy.ts y manda al login con el
 * aviso de "sesión cerrada por inactividad".
 *
 * Borrar las cookies de actividad es lo importante: son httpOnly, el
 * navegador no puede borrarlas solo, y si quedaran viejas el proxy
 * cerraría la sesión otra vez apenas la persona vuelva a loguearse.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL('/auth/login', request.url);
  url.searchParams.set('redirect', '/admin');
  url.searchParams.set('expired', '1');

  const res = NextResponse.redirect(url);
  res.cookies.delete('admin_last_activity');
  res.cookies.delete('user_last_activity');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
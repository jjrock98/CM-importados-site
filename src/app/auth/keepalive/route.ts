import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Latido de actividad de CLIENTES logueados (lo llama UserIdleTimer).
 *
 * Es una ruta de página (no /api/) a propósito: proxy.ts solo renueva la
 * cookie `user_last_activity` en pedidos que no son /api/. Así, un cliente
 * que está activo en una misma pantalla (armando el carrito, leyendo un
 * producto) no es deslogueado por el servidor en su próxima navegación.
 *
 *  - 204: hay sesión válida (el proxy ya renovó la cookie de actividad).
 *  - 401: no hay sesión (venció o se cerró) → el cliente cierra su estado.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return new NextResponse(null, {
    status: user ? 204 : 401,
    headers: { 'Cache-Control': 'no-store' },
  });
}
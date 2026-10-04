import { NextResponse } from 'next/server';

/**
 * Latido de actividad del panel admin (lo llama AdminIdleTimer).
 *
 * Por qué es una ruta bajo /admin y no bajo /api/admin: proxy.ts solo
 * renueva la cookie `admin_last_activity` en pedidos que NO son /api/.
 * Pasando por acá, el proxy valida sesión + rol admin + 2FA y, si todo
 * está bien, renueva la cookie de actividad. Si la sesión ya venció por
 * inactividad, el proxy responde con un redirect (y el cliente lo
 * interpreta como "sesión expirada").
 *
 * No devuelve datos: solo 204.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}
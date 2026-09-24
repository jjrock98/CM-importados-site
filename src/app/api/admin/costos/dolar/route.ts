import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

const DOLAR_BLUE_URL = 'https://dolarapi.com/v1/dolares/blue';
const TIMEOUT_MS = 6000;

/**
 * GET /api/admin/costos/dolar
 *
 * Consulta el Dólar Blue en DolarAPI y devuelve { compra, venta, fecha }.
 * Para convertir USD → ARS se usa SIEMPRE "venta". Si la API falla
 * (timeout, red, respuesta inválida o sin "venta"), responde 502 con un
 * mensaje: nunca inventa una cotización — la pantalla ofrece ingresarla
 * a mano.
 */
export async function GET() {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(DOLAR_BLUE_URL, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `DolarAPI respondió ${res.status}` }, { status: 502 });
    }

    const json = (await res.json()) as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown };
    const venta = Number(json?.venta);
    if (!Number.isFinite(venta) || venta <= 0) {
      return NextResponse.json({ error: 'DolarAPI devolvió una respuesta sin "venta" válida' }, { status: 502 });
    }

    const compra = Number(json?.compra);
    return NextResponse.json({
      compra: Number.isFinite(compra) && compra > 0 ? compra : null,
      venta,
      fecha: typeof json.fechaActualizacion === 'string' ? json.fechaActualizacion : null,
    });
  } catch (err) {
    const timeout = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      { error: timeout ? 'DolarAPI no respondió a tiempo' : 'No se pudo conectar con DolarAPI' },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/bank-info
 *
 * Endpoint público (sin auth) que devuelve los datos bancarios cargados
 * por el admin en /admin/configuracion. Es información que de todos
 * modos hay que mostrarle a cualquier comprador que elija transferencia
 * — no expone nada sensible del negocio (es lo mismo que un cartel con
 * el CBU en un local físico).
 */
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin.from('bank_info').select('*').single();
  // ✅ Cambia poco (solo cuando el admin edita en /admin/configuracion).
  // Con esto, Vercel/el CDN puede servir la respuesta desde caché en
  // vez de invocar la función y consultar la DB en cada pedido — la
  // mejor defensa posible ante un flood: ni siquiera llega acá.
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}

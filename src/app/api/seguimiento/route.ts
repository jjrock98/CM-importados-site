import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimiters } from '@/lib/rateLimit';

/**
 * GET /api/seguimiento?id=XXXXXXXX&email=cliente@email.com
 *
 * Endpoint público para que invitados (sin login) puedan
 * ver el estado de su pedido. Requiere el ID de pedido
 * y el email con el que compraron (validación básica de identidad).
 */
export async function GET(req: NextRequest) {
  // ✅ FIX: no tenía límite de intentos — sin esto, alguien que ya sabe
  // el email de una compra podía probar miles de combinaciones del
  // prefijo de 8 caracteres del pedido sin ningún freno, hasta acertar
  // y ver nombre/dirección/teléfono/contenido de un pedido ajeno.
  const limited = rateLimiters.seguimiento(req);
  if (limited) return limited;

  const { searchParams } = req.nextUrl;
  const rawId = searchParams.get('id')?.trim();
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!rawId || !email) {
    return NextResponse.json(
      { error: 'ID de pedido y email son requeridos' },
      { status: 400 }
    );
  }

  // Aceptar el ID completo (UUID) o el código corto de 8 caracteres que ven
  // los clientes en el email y en la pantalla de confirmación (#A1B2C3D4).
  // ✅ FIX: antes el código corto se buscaba con ilike('id', 'xxxx%'), pero
  // `id` es de tipo uuid y Postgres no tiene ILIKE para uuid: la consulta
  // fallaba y el cliente veía "No encontramos ningún pedido" aunque el
  // número fuera correcto. Ahora el prefijo se busca como rango de UUID.
  const cleanId = rawId.replace(/^#/, '').toLowerCase();
  const isFull  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(cleanId);
  const isShort = /^[0-9a-f]{8}$/.test(cleanId);

  const NOT_FOUND = NextResponse.json(
    { error: 'No encontramos un pedido con esos datos' },
    { status: 404 }
  );
  if (!isFull && !isShort) return NOT_FOUND;

  const admin = createAdminClient();
  let query = admin
    .from('orders')
    .select(`
      id, created_at, estado, metodo_pago, tipo_entrega,
      nombre, email, direccion, ciudad, codigo_postal,
      micro_terminal, micro_empresa_transporte, micro_nombre_recibe,
      subtotal, costo_envio, total,
      rejection_reason, notas, tipo_venta,
      order_items(id, nombre_snap, tipo_pack, cantidad_packs, unidades, precio_unit, subtotal)
    `);

  query = isFull
    ? query.eq('id', cleanId)
    : query
        .gte('id', `${cleanId}-0000-0000-0000-000000000000`)
        .lte('id', `${cleanId}-ffff-ffff-ffff-ffffffffffff`);

  const { data: orders } = await query.limit(10);

  // El email tiene que coincidir. Se devuelve el mismo error si no existe el
  // pedido o si el email no es el de la compra, para no confirmar a un
  // tercero qué números de pedido existen.
  const order = orders?.find((o) => o.email.toLowerCase() === email);
  if (!order) return NOT_FOUND;

  return NextResponse.json({ data: order });
}
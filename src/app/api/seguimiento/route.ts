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

  // Aceptar tanto el ID completo (UUID) como los primeros 8 caracteres
  const admin = createAdminClient();
  let query = admin
    .from('orders')
    .select(`
      id, created_at, estado, metodo_pago, tipo_entrega,
      nombre, email, direccion, ciudad, codigo_postal,
      subtotal, costo_envio, total,
      rejection_reason, notas, tipo_venta,
      order_items(id, nombre_snap, tipo_pack, cantidad_packs, unidades, precio_unit, subtotal)
    `);

  // Si tiene formato UUID completo, buscar por ID exacto
  if (rawId.length === 36) {
    query = query.eq('id', rawId);
  } else {
    // Buscar por los primeros 8 caracteres del UUID (formato amigable)
    query = query.ilike('id', `${rawId}%`);
  }

  const { data: orders } = await query.limit(1);
  const order = orders?.[0];

  if (!order) {
    return NextResponse.json(
      { error: 'No encontramos ningún pedido con ese número' },
      { status: 404 }
    );
  }

  // Validar que el email coincide (previene que alguien adivine IDs)
  if (order.email.toLowerCase() !== email) {
    return NextResponse.json(
      { error: 'El email no coincide con el de la compra' },
      { status: 403 }
    );
  }

  return NextResponse.json({ data: order });
}

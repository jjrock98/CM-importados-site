import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimiters } from '@/lib/rateLimit';
import { z } from 'zod';

const schema = z.object({
  productId: z.string().uuid(),
  email:     z.string().email(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimiters.contact(req);
  if (limited) return limited;

  try {
    const body   = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 });
    }
    const { productId, email } = parsed.data;

    const admin = createAdminClient();

    // Verificar que el producto existe y está agotado
    const { data: product } = await admin
      .from('products').select('id, stock_unidades, nombre, activo')
      .eq('id', productId).single();

    if (!product || !product.activo) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    if (product.stock_unidades >= 6) {
      return NextResponse.json({ error: 'El producto tiene stock disponible' }, { status: 409 });
    }

    // Guardar suscripción (ON CONFLICT DO NOTHING — no duplicar)
    const { error } = await admin
      .from('stock_notifications')
      .upsert({ product_id: productId, email }, { onConflict: 'product_id,email' });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('stock-notify error:', err);
    return NextResponse.json({ error: 'Error al registrar notificación' }, { status: 500 });
  }
}

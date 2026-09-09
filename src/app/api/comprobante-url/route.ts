import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/comprobante-url?orderId=...
 *
 * Por qué existe: el bucket 'comprobantes' es privado (public: FALSE en
 * el schema). Antes se guardaba en orders.comprobante_url el resultado
 * de storage.getPublicUrl(), pero esa función arma una URL bajo
 * /storage/v1/object/public/... que Supabase Storage rechaza siempre
 * que el bucket no sea público — sin importar quién la pida ni qué
 * políticas de RLS existan sobre storage.objects (esas policies solo
 * aplican al endpoint autenticado/firmado, no al público). Resultado:
 * ni el admin ni el dueño del pedido podían nunca abrir el link.
 *
 * La solución correcta para un bucket privado es una signed URL,
 * generada bajo demanda (con vencimiento corto) en el momento en que
 * alguien autorizado la pide — nunca se guarda una URL permanente.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'orderId requerido' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, comprobante_url')
    .eq('id', orderId)
    .single();

  if (!order || !order.comprobante_url) {
    return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
  }

  // ── Autorización: dueño del pedido, o admin ──────────────────
  let autorizado = order.user_id === user.id;
  if (!autorizado) {
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single();
    autorizado = profile?.rol === 'admin';
  }
  if (!autorizado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // ── Extraer el path real dentro del bucket ───────────────────
  // Compatible con pedidos viejos (que guardaron la URL "pública" rota,
  // de la que hay que recortar el path) y con pedidos nuevos (que ya
  // guardan directamente el path crudo — ver fix en upload-comprobante).
  const marker = '/comprobantes/';
  const idx = order.comprobante_url.indexOf(marker);
  const path = idx !== -1
    ? decodeURIComponent(order.comprobante_url.slice(idx + marker.length))
    : order.comprobante_url;

  const { data: signed, error } = await admin.storage
    .from('comprobantes')
    .createSignedUrl(path, 60 * 5); // 5 minutos, se genera de nuevo cada vez que se pide

  if (error || !signed) {
    console.error('Error generando signed URL de comprobante:', error);
    return NextResponse.json({ error: 'No se pudo generar el link del comprobante' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
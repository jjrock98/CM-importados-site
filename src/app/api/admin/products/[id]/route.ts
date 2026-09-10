import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { env } from '@/env';

// Notifica a suscriptores de "Avísame cuando haya stock" cuando el admin repone
async function notifyStockSubscribers(productId: string, productName: string) {
  try {
    const admin = createAdminClient();
    const { data: subscribers } = await admin
      .from('stock_notifications')
      .select('email')
      .eq('product_id', productId)
      .eq('notified', false);

    if (!subscribers || subscribers.length === 0) return;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from   = `${process.env.RESEND_FROM_NAME ?? 'Mi Tienda'} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@mitienda.com'}>`;
    const appUrl = env.APP_URL;

    // Enviar a cada suscriptor (en paralelo)
    await Promise.allSettled(
      subscribers.map((sub) =>
        resend.emails.send({
          from,
          to:      sub.email,
          subject: `¡${productName} volvió a tener stock! 🎉`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px 16px;">
              <h1 style="font-size:24px;color:#111827;">¡Buenas noticias!</h1>
              <p style="color:#6b7280;">Nos pediste que te avisemos cuando <strong>${productName}</strong> tuviera stock nuevamente.</p>
              <p style="color:#6b7280;">¡Ya está disponible! Entrá rápido antes de que se agote.</p>
              <a href="${appUrl}" style="display:inline-block;margin-top:16px;background:#2c4270;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;">
                Ver producto
              </a>
              <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Recibiste este email porque te suscribiste a las alertas de stock en ${appUrl}</p>
            </div>`,
        })
      )
    );

    // Marcar como notificados
    await admin.from('stock_notifications')
      .update({ notified: true })
      .eq('product_id', productId)
      .eq('notified', false);
  } catch (err) {
    console.error('[StockNotify] Error notificando suscriptores:', err);
  }
}

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

// ✅ Next 16: params ahora es una Promise, hay que await-earlo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body  = await req.json();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('products')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si el admin aumentó el stock, avisar a los suscriptores
  const newStock = (body as { stock_unidades?: number }).stock_unidades;
  if (typeof newStock === 'number' && newStock > 0 && data) {
    const productName = (data as { nombre?: string }).nombre ?? 'Producto';
    notifyStockSubscribers(id, productName).catch(console.error);
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  // Soft delete: just mark inactive, preserve order history
  const { error } = await admin
    .from('products')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
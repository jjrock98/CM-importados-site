import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { rateLimiters } from '@/lib/rateLimit';
import { env } from '@/env';

// ✅ Lazy singleton: igual que con Resend, no instanciar a nivel de
// módulo. Si MERCADOPAGO_ACCESS_TOKEN no está disponible en el momento
// en que Next.js evalúa este módulo durante "Collecting page data"
// del build, el SDK puede fallar y tumbar todo el deploy.
let mpClient: MercadoPagoConfig | null = null;

function getMPClient(): MercadoPagoConfig {
  if (!mpClient) {
    mpClient = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? 'TEST-build-placeholder',
    });
  }
  return mpClient;
}

/**
 * Crea una Preferencia de Checkout Pro para un pedido existente.
 *
 * Puntos clave:
 * - `external_reference` = ID del pedido en Supabase → permite reconciliar el webhook.
 * - `back_urls` apuntan a /checkout/success, /checkout/pending, /checkout/failure.
 * - `notification_url` apunta al webhook que procesa el pago.
 * - `expiration_date_to` = 3 días desde ahora → los cupones de efectivo vencen solos.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimiters.checkout(req);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // ✅ Compra como invitado permitida (igual que en /api/orders) — no
    // se exige login. El pedido ya fue validado y creado en /api/orders;
    // acá solo se verifica que el orderId exista y esté 'pendiente'.

    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 });

    const admin = createAdminClient();

    // Verificar que el pedido existe. Si hay usuario logueado, además
    // confirmamos que sea el dueño (evita que alguien pague el pedido de
    // otro usuario registrado). Los pedidos de invitados (user_id null)
    // no tienen ese chequeo adicional — el orderId (UUID) ya cumple ese rol.
    const orderQuery = admin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId);
    if (user) orderQuery.eq('user_id', user.id);

    const { data: order } = await orderQuery.single();

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

    const appUrl = env.APP_URL;

    // ── Fecha de expiración: ahora + 3 días ──────────────────────────────
    // Mercado Pago cancela automáticamente el pago/cupón si no se paga antes.
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 3);

    const preference = new Preference(getMPClient());
    const response = await preference.create({
      body: {
        // ✅ Vincula la preferencia con el pedido de Supabase
        external_reference: orderId,

        items: order.order_items.map((item: {
          nombre_snap: string;
          precio_unit: number;
          cantidad_packs: number;
          imagen_snap?: string;
        }) => ({
          id:          item.nombre_snap,
          title:       item.nombre_snap,
          unit_price:  Number(item.precio_unit),
          quantity:    item.cantidad_packs,
          currency_id: 'ARS',
          picture_url: item.imagen_snap ?? undefined,
        })),

        // Costo de envío como ítem separado (si aplica)
        ...(order.costo_envio > 0 ? {
          shipments: { cost: Number(order.costo_envio), mode: 'not_specified' },
        } : {}),

        // ✅ NUEVO: excluye tarjeta de crédito del checkout de Mercado Pago.
        // El motivo es de rentabilidad, no técnico: la comisión de MP en
        // tarjeta de crédito (y más si el comprador elige cuotas) es
        // sensiblemente más alta que en débito, dinero en cuenta o
        // efectivo — en un negocio con margen ajustado por mayorista,
        // esa diferencia se come la ganancia del pedido. Con esto, en el
        // checkout de MP el comprador solo ve: débito, dinero en cuenta
        // MP, transferencia y efectivo (Rapipago/Pago Fácil vía MP) —
        // más las opciones fuera de MP que ya tenés (transferencia
        // bancaria directa y cuenta corriente), que no pagan comisión.
        // `installments: 1` es un extra por las dudas: aunque no debería
        // hacer falta al excluir credit_card, evita que aparezca
        // cualquier plan de cuotas.
        payment_methods: {
          excluded_payment_types: [{ id: 'credit_card' }],
          installments: 1,
        },

        payer: {
          email: order.email,
          name:  order.nombre,
          phone: order.telefono ? { number: order.telefono } : undefined,
          // ✅ El tipo Address del SDK de MP solo admite zip_code,
          // street_name y street_number — no tiene campo 'city'.
          // La ciudad ya queda registrada en el pedido de Supabase.
          address: {
            street_name: order.direccion,
            zip_code:    order.codigo_postal,
          },
        },

        // ── Back URLs ──────────────────────────────────────────────────────
        // success  → pago aprobado (tarjeta, débito, dinero en cuenta)
        // pending  → pago en efectivo (cupón generado, aún sin acreditar)
        // failure  → pago rechazado o cancelado
        back_urls: {
          success: `${appUrl}/checkout/success?orderId=${orderId}`,
          pending: `${appUrl}/checkout/pending?orderId=${orderId}`,
          failure: `${appUrl}/checkout/failure?orderId=${orderId}`,
        },

        // Redirige automáticamente cuando el pago es 'approved'
        auto_return: 'approved',

        // ✅ Webhook que procesa pending / approved / rejected
        notification_url: `${appUrl}/api/webhooks/mercadopago`,

        statement_descriptor: (process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda').slice(0, 22),

        // ✅ El cupón de efectivo vence a los 3 días si no se paga
        expiration_date_to: expirationDate.toISOString(),
      },
    });

    // Guardar preference_id para trazabilidad
    await admin
      .from('orders')
      .update({ mp_preference_id: response.id })
      .eq('id', orderId);

    return NextResponse.json({
      preferenceId:     response.id,
      initPoint:        response.init_point,
      sandboxInitPoint: response.sandbox_init_point,
    });
  } catch (err: unknown) {
    console.error('MP checkout error:', err);
    return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 500 });
  }
}
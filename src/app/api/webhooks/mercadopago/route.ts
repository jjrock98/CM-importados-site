import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendCashPaymentPendingEmail,
  sendAdminOrderStatusEmail,
  sendOrderRefundedEmail,
} from '@/lib/email';
import { refundMercadoPagoPayment } from '@/lib/mercadopago-refund';
import { sendAdminPushNotification } from '@/lib/webpush';
import type { Order, OrderEstado } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

interface MPWebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

interface MPPaymentResponse {
  id: number;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  status_detail: string;
  external_reference: string | null;
  date_approved: string | null;
  transaction_amount: number;
}

// ============================================================
// SECURITY — Verificación de firma x-signature
// ============================================================

/**
 * Verifica que la notificación realmente provenga de Mercado Pago,
 * usando el mecanismo oficial de "Clave secreta" (HMAC-SHA256).
 *
 * Sin esto, cualquiera que conozca la URL del webhook podría enviar
 * un POST falso simulando "payment approved" y marcar pedidos como
 * pagados sin que el cliente haya pagado realmente.
 *
 * Documentación oficial:
 * https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
 *
 * Header recibido: x-signature: ts=1704908010,v1=618c85345248dd...
 * Manifest a firmar: `id:{data.id};request-id:{x-request-id};ts:{ts};`
 *
 * El secreto se obtiene en: Tus integraciones → tu app → Webhooks →
 * "Clave secreta" (NO es el Access Token, es un valor distinto).
 */
function verifyMPSignature(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  // Si todavía no configuraste el secreto, no podemos validar.
  // Se loguea fuerte para que sea imposible no darse cuenta, pero
  // se permite continuar para no romper el webhook durante la
  // migración (ver guía de configuración).
  if (!secret) {
    console.warn(
      '[MP Webhook] ⚠️ MERCADOPAGO_WEBHOOK_SECRET no configurado — ' +
      'la notificación NO está siendo verificada criptográficamente. ' +
      'Configurá esta variable cuanto antes (ver Tus integraciones → Webhooks → Clave secreta).'
    );
    return true;
  }

  const signatureHeader = req.headers.get('x-signature');
  const requestId       = req.headers.get('x-request-id');

  if (!signatureHeader || !requestId) {
    console.error('[MP Webhook] Faltan headers x-signature o x-request-id');
    return false;
  }

  // x-signature viene como "ts=171234567,v1=abcdef..."
  const parts: Record<string, string> = {};
  signatureHeader.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  });

  const ts          = parts['ts'];
  const receivedSig = parts['v1'];
  if (!ts || !receivedSig) {
    console.error('[MP Webhook] Formato de x-signature inesperado:', signatureHeader);
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expectedSig = createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparación en tiempo constante para evitar timing attacks
  const a = Buffer.from(receivedSig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

// ============================================================
// MAIN HANDLER
// ============================================================

/**
 * Webhook de Mercado Pago.
 *
 * REGLA DE ORO: siempre responder 200 OK, incluso si algo falla internamente.
 * Si devolvemos un error HTTP, MP reintenta el mismo evento indefinidamente,
 * lo que puede generar procesamientos duplicados o saturar logs.
 * Los errores se loguean para debugging pero nunca se propagan al status code.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as MPWebhookBody | null;

    // Mercado Pago envía distintos tipos de eventos (payment, merchant_order, etc.)
    // Solo nos interesan los de tipo "payment"
    if (!body || body.type !== 'payment') {
      return ackOk();
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.warn('[MP Webhook] Evento "payment" sin data.id', body);
      return ackOk();
    }

    // ── 0. Verificar la firma criptográfica ANTES de procesar nada ──────────
    const isValidSignature = verifyMPSignature(req, String(paymentId));
    if (!isValidSignature) {
      console.error(`[MP Webhook] ❌ Firma inválida para payment ${paymentId} — notificación rechazada, posible intento de falsificación`);
      // Respondemos 200 igual (no le damos información a un posible atacante
      // sobre por qué falló), pero NO procesamos el pago.
      return ackOk();
    }

    // ── 1. Verificar el pago REAL contra la API de Mercado Pago ──────────────
    // Nunca confiamos en el payload del webhook por sí solo: siempre se
    // re-consulta el estado real para evitar payloads falsificados.
    const payment = await fetchPaymentFromMP(String(paymentId));
    if (!payment) {
      console.error(`[MP Webhook] No se pudo obtener el pago ${paymentId} desde la API de MP`);
      return ackOk();
    }

    const orderId = payment.external_reference;
    if (!orderId) {
      console.warn(`[MP Webhook] Pago ${paymentId} sin external_reference`);
      return ackOk();
    }

    // ── 2. Cliente Supabase con SERVICE_ROLE (bypass RLS, contexto backend) ──
    const admin = createAdminClient();

    // ── 3. Procesar según el estado del pago ─────────────────────────────────
    await processPaymentStatus(admin, orderId, payment);

    return ackOk();
  } catch (err: unknown) {
    // Cualquier error inesperado se loguea pero NUNCA se devuelve como 5xx,
    // para que MP no reintente infinitamente un evento que rompe nuestro código.
    console.error('[MP Webhook] Error no controlado:', err);
    return ackOk();
  }
}

// ============================================================
// HELPERS
// ============================================================

/** Respuesta estándar 200 OK para Mercado Pago */
function ackOk() {
  return NextResponse.json({ received: true }, { status: 200 });
}

/**
 * Consulta el estado real del pago en la API de Mercado Pago.
 * Usamos fetch directo (no el SDK) para tener control total sobre
 * timeouts y manejo de errores en el contexto de un webhook.
 */
async function fetchPaymentFromMP(paymentId: string): Promise<MPPaymentResponse | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
      // Evitar que Next cachee esta llamada
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[MP Webhook] GET /v1/payments/${paymentId} → ${res.status}`);
      return null;
    }

    return (await res.json()) as MPPaymentResponse;
  } catch (err) {
    console.error(`[MP Webhook] Error consultando pago ${paymentId}:`, err);
    return null;
  }
}

/**
 * Procesa el pago según su estado, con lógica idempotente:
 * cada rama verifica el estado actual del pedido antes de actuar,
 * para que reintentos del mismo webhook no dupliquen efectos
 * (doble descuento de stock, doble email, etc.)
 */
async function processPaymentStatus(
  admin: SupabaseClient,
  orderId: string,
  payment: MPPaymentResponse
): Promise<void> {
  const { status, status_detail, id: mpPaymentId, date_approved } = payment;

  // Obtener el pedido actual (con lock implícito vía RPC más adelante si aplica)
  const { data: order, error: fetchErr } = await admin
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) {
    console.error(`[MP Webhook] Pedido ${orderId} no encontrado`, fetchErr);
    return;
  }

  const currentOrder = order as Order;

  switch (status) {
    // ════════════════════════════════════════════════════════════════════
    // PENDING — pago en efectivo (Rapipago, Pago Fácil, etc.)
    // El cupón fue generado pero el cliente aún no fue a pagarlo.
    // ════════════════════════════════════════════════════════════════════
    case 'pending':
    case 'in_process': {
      // Idempotencia: si ya está en 'pendiente_pago' con el mismo payment_id,
      // no reenviamos el email de nuevo.
      const alreadyNotified =
        currentOrder.estado === 'pendiente_pago' &&
        currentOrder.mp_payment_id === String(mpPaymentId);

      await admin
        .from('orders')
        .update({
          estado:           'pendiente_pago' as OrderEstado,
          mp_payment_id:     String(mpPaymentId),
          mp_status_detail:  status_detail,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', orderId);

      if (!alreadyNotified) {
        const { data: refreshed } = await admin
          .from('orders').select('*, order_items(*)').eq('id', orderId).single();

        if (refreshed) {
          await sendCashPaymentPendingEmail(refreshed as Order).catch((err) =>
            console.error('[MP Webhook] Error enviando email de cupón pendiente:', err)
          );
        }
      }

      console.log(`[MP Webhook] Pedido ${orderId} → pendiente_pago (${status_detail})`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════
    // APPROVED — pago acreditado (tarjeta, débito, dinero en cuenta,
    // o efectivo que ya fue pagado físicamente)
    // ════════════════════════════════════════════════════════════════════
    case 'approved': {
      // Idempotencia CRÍTICA: si el stock ya fue descontado, no repetir.
      // Esto cubre el caso de reintentos del mismo webhook approved.
      if (currentOrder.stock_descontado && currentOrder.estado === 'pagado') {
        console.log(`[MP Webhook] Pedido ${orderId} ya estaba pagado — ignorando duplicado`);
        // Aun así actualizamos el payment_id por si cambió (no debería)
        await admin
          .from('orders')
          .update({ mp_payment_id: String(mpPaymentId), mp_status_detail: status_detail })
          .eq('id', orderId);
        break;
      }

      // Descuento atómico de stock vía función SQL con SELECT FOR UPDATE.
      // Esta función verifica stock disponible y marca estado='pagado'
      // en una sola transacción.
      const { data: result } = await admin.rpc('descontar_stock_seguro', {
        p_order_id: orderId,
      });

      if (!result?.success) {
        // ══════════════════════════════════════════════════════════════
        // DOBLE VENTA GENUINA — el pago llegó 'approved' desde MP pero
        // ya no queda stock (otro comprador se quedó con la última
        // unidad milisegundos antes). En vez de dejar al cliente
        // cobrado sin producto, se reembolsa automáticamente el 100%
        // del pago vía la API de Mercado Pago.
        // ══════════════════════════════════════════════════════════════
        console.error(`[MP Webhook] Fallo al descontar stock para ${orderId}:`, result);

        const refund = await refundMercadoPagoPayment(String(mpPaymentId), `refund-${orderId}`);

        const notaBase = refund.success
          ? refund.alreadyRefunded
            ? '💳 Pago reembolsado automáticamente (ya estaba reembolsado — reintento de webhook).'
            : `💳 Pago reembolsado automáticamente por falta de stock (doble venta). ID reembolso: ${refund.refundId}.`
          : `⚠️ Pago aprobado sin stock suficiente. FALLÓ el reembolso automático (${refund.error}). Revisar y reembolsar manualmente desde el panel de Mercado Pago.`;

        await admin
          .from('orders')
          .update({
            mp_payment_id:    String(mpPaymentId),
            mp_status_detail: status_detail,
            estado:           refund.success ? ('cancelado' as OrderEstado) : currentOrder.estado,
            notas: `${currentOrder.notas ?? ''}\n${notaBase}`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        // Auditoría del reembolso
        void admin.from('notificaciones_admin').insert({
          tipo: 'email',
          evento: refund.success ? 'auto_refund_success' : 'auto_refund_failed',
          order_id: orderId,
          enviado: refund.success,
          error: refund.success ? null : refund.error,
        });

        // Notificar al cliente y al admin
        const { data: refundedOrder } = await admin
          .from('orders').select('*, order_items(*)').eq('id', orderId).single();

        if (refundedOrder) {
          const o = refundedOrder as Order;
          if (refund.success) {
            sendOrderRefundedEmail(o, refund.amount).catch((err) =>
              console.error('[MP Webhook] Error enviando email de reembolso:', err)
            );
          }
          sendAdminOrderStatusEmail(o,
            refund.success
              ? `💳 Reembolso automático procesado — Pedido #${o.id.slice(0,8).toUpperCase()}`
              : `🚨 URGENTE: reembolso automático FALLÓ — Pedido #${o.id.slice(0,8).toUpperCase()}`
          ).catch(console.error);
          sendAdminPushNotification({
            title: refund.success ? '💳 Reembolso automático procesado' : '🚨 Reembolso falló — acción requerida',
            body:  `Pedido #${o.id.slice(0,8).toUpperCase()} — doble venta detectada.`,
            tag:   'auto-refund',
            data:  { url: '/admin/pedidos' },
          }).catch(console.error);
        }

        break;
      }

      // Registrar metadata del pago + fecha de acreditación
      await admin
        .from('orders')
        .update({
          mp_payment_id:    String(mpPaymentId),
          mp_status_detail: status_detail,
          fecha_pago:       date_approved ?? new Date().toISOString(),
          updated_at:       new Date().toISOString(),
        })
        .eq('id', orderId);

      // Email de confirmación de compra exitosa
      const { data: paidOrder } = await admin
        .from('orders').select('*, order_items(*)').eq('id', orderId).single();

      if (paidOrder) {
        await sendOrderConfirmationEmail(paidOrder as Order).catch((err) =>
          console.error('[MP Webhook] Error enviando email de confirmación:', err)
        );
        sendAdminOrderStatusEmail(paidOrder as Order, 'Pago aprobado por Mercado Pago').catch(console.error);
        sendAdminPushNotification({
          title: '💳 Nuevo pago aprobado',
          body:  `Pedido #${(paidOrder as Order).id.slice(0,8).toUpperCase()} de ${(paidOrder as Order).nombre} — Mercado Pago.`,
          tag:   'mp-payment',
          data:  { url: '/admin/pedidos' },
        }).catch(console.error);
      }

      console.log(`[MP Webhook] Pedido ${orderId} → pagado ✅ (stock descontado)`);
      // Audit log en notificaciones_admin
      void admin.from('notificaciones_admin').insert({
        tipo: 'push', evento: 'mp_payment_approved', order_id: orderId, enviado: true,
      });
      break;
    }

    // ════════════════════════════════════════════════════════════════════
    // REJECTED / CANCELLED — pago rechazado o cupón vencido sin pagar
    // ════════════════════════════════════════════════════════════════════
    case 'rejected':
    case 'cancelled': {
      // Idempotencia: si ya está cancelado, no repetir efectos.
      if (currentOrder.estado === 'cancelado') {
        console.log(`[MP Webhook] Pedido ${orderId} ya estaba cancelado — ignorando duplicado`);
        break;
      }

      // Si el stock había sido descontado (caso raro: approved → luego
      // refunded/chargeback llega como rejected), lo devolvemos.
      if (currentOrder.stock_descontado) {
        const { data: restoreResult } = await admin.rpc('devolver_stock_seguro', {
          p_order_id: orderId,
        });

        if (!restoreResult?.success) {
          console.error(`[MP Webhook] Error devolviendo stock para ${orderId}:`, restoreResult);
        } else {
          console.log(`[MP Webhook] Stock restaurado para pedido ${orderId}`);
        }
      }

      await admin
        .from('orders')
        .update({
          estado:           'cancelado' as OrderEstado,
          mp_payment_id:     String(mpPaymentId),
          mp_status_detail:  status_detail,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', orderId);

      // Notificar al cliente que el pedido fue cancelado
      const { data: cancelledOrder } = await admin
        .from('orders').select('*, order_items(*)').eq('id', orderId).single();

      if (cancelledOrder) {
        await sendOrderStatusEmail(cancelledOrder as Order).catch((err) =>
          console.error('[MP Webhook] Error enviando email de cancelación:', err)
        );
      }

      console.log(`[MP Webhook] Pedido ${orderId} → cancelado (${status_detail})`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════
    // REFUNDED / CHARGED_BACK — devolución o contracargo posterior
    // ════════════════════════════════════════════════════════════════════
    case 'refunded':
    case 'charged_back': {
      if (currentOrder.stock_descontado) {
        await admin.rpc('devolver_stock_seguro', { p_order_id: orderId });
      }

      await admin
        .from('orders')
        .update({
          estado:           'cancelado' as OrderEstado,
          mp_status_detail: status_detail,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', orderId);

      console.log(`[MP Webhook] Pedido ${orderId} → ${status} (reembolso/contracargo)`);
      break;
    }

    // ════════════════════════════════════════════════════════════════════
    // ESTADO DESCONOCIDO — solo registrar, no actuar
    // ════════════════════════════════════════════════════════════════════
    default: {
      console.warn(`[MP Webhook] Estado no manejado para pedido ${orderId}: ${status}`);
      await admin
        .from('orders')
        .update({ mp_status_detail: status_detail, updated_at: new Date().toISOString() })
        .eq('id', orderId);
    }
  }
}

// Webhooks de pago necesitan runtime Node (no edge) por las llamadas fetch a MP
export const runtime = 'nodejs';

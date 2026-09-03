import { randomUUID } from 'crypto';

/**
 * Reembolso automático vía API de Mercado Pago.
 *
 * Caso de uso: el webhook recibe un pago 'approved' pero al intentar
 * descontar_stock_seguro no hay stock suficiente (doble venta genuina —
 * dos compradores pagaron el mismo último artículo casi simultáneamente
 * y ambos pagos fueron aprobados por MP antes de que nuestra DB pudiera
 * reaccionar). En vez de dejar cobrado a un cliente sin producto, se
 * reembolsa automáticamente todo el monto.
 *
 * Documentación oficial:
 * https://www.mercadopago.com.ar/developers/es/reference/chargebacks/_payments_id_refunds/post
 *
 * POST /v1/payments/{id}/refunds
 * Sin "amount" en el body = reembolso TOTAL del pago.
 * X-Idempotency-Key es obligatorio: si Vercel reintenta la función por
 * timeout, un mismo UUID evita que se genere un segundo reembolso
 * duplicado para el mismo evento.
 */

export interface RefundResult {
  success: boolean;
  refundId?: number;
  amount?: number;
  error?: string;
  alreadyRefunded?: boolean;
}

export async function refundMercadoPagoPayment(
  paymentId: string,
  idempotencyKey?: string
): Promise<RefundResult> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'MERCADOPAGO_ACCESS_TOKEN no configurado' };
  }

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization':      `Bearer ${accessToken}`,
        'Content-Type':       'application/json',
        'X-Idempotency-Key':  idempotencyKey ?? randomUUID(),
      },
      // Body vacío = reembolso total. No se envía "amount".
      body: '{}',
    });

    const data = await res.json().catch(() => null);

    if (res.status === 201) {
      return { success: true, refundId: data?.id, amount: data?.amount };
    }

    // MP devuelve 400 con este mensaje si el pago ya estaba reembolsado
    // (ej: reintento del webhook) — lo tratamos como éxito idempotente.
    const alreadyRefundedMsgs = ['already_refunded', 'amount_already_refunded'];
    const errorCause = data?.cause?.[0]?.code ?? data?.error ?? '';
    if (res.status === 400 && alreadyRefundedMsgs.some((m) => String(errorCause).includes(m))) {
      return { success: true, alreadyRefunded: true };
    }

    return {
      success: false,
      error: data?.message ?? `MP respondió ${res.status} al intentar reembolsar`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error de red al contactar Mercado Pago',
    };
  }
}

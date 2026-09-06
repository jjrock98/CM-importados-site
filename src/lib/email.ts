import { Resend } from 'resend';
import type { Order } from '@/types';
import {
  orderConfirmationHtml,
  orderStatusHtml,
  contactNotificationHtml,
  contactConfirmationHtml,
  cashPaymentPendingHtml,
  adminOrderNotificationHtml,
  orderExpiredHtml,
  orderRefundedHtml,
  stockNotifyAdminHtml,
} from './emails/templates';

const FROM   = `${process.env.RESEND_FROM_NAME ?? 'Mi Tienda'} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@mitienda.com'}>`;
const ADMIN  = process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? '';

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');
  return resendClient;
}

// ── Cliente ───────────────────────────────────────────────────────────────────

export async function sendOrderConfirmationEmail(order: Order) {
  return getResend().emails.send({
    from: FROM, to: order.email,
    subject: `Pedido #${order.id.slice(0,8).toUpperCase()} confirmado ✓`,
    html: orderConfirmationHtml(order),
  });
}

export async function sendOrderStatusEmail(order: Order) {
  return getResend().emails.send({
    from: FROM, to: order.email,
    subject: `Tu pedido está ${order.estado} – ${process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda'}`,
    html: orderStatusHtml(order),
  });
}

export async function sendCashPaymentPendingEmail(order: Order) {
  return getResend().emails.send({
    from: FROM, to: order.email,
    subject: `🧾 Tu cupón de pago fue generado — Pedido #${order.id.slice(0,8).toUpperCase()}`,
    html: cashPaymentPendingHtml(order),
  });
}

/**
 * REGLA DE NEGOCIO 3 — Notificación de expiración automática.
 * Se envía cuando el cron cancela un pedido con pago manual que
 * superó el tiempo de retención configurado por el admin, y el
 * stock reservado ya fue devuelto al inventario público.
 */
export async function sendOrderExpiredEmail(order: Order) {
  return getResend().emails.send({
    from: FROM, to: order.email,
    subject: `Tu pedido #${order.id.slice(0,8).toUpperCase()} expiró por falta de pago`,
    html: orderExpiredHtml(order),
  });
}

/**
 * Email al cliente cuando se procesa un reembolso automático por
 * doble venta (pago aprobado pero sin stock disponible).
 */
export async function sendOrderRefundedEmail(order: Order, refundAmount?: number) {
  return getResend().emails.send({
    from: FROM, to: order.email,
    subject: `Reembolsamos tu pago — Pedido #${order.id.slice(0,8).toUpperCase()}`,
    html: orderRefundedHtml(order, refundAmount),
  });
}

/** Envía correo al admin Y confirmación al cliente cuando usa el formulario de contacto */
export async function sendContactMessageEmail(
  nombre: string, email: string, asunto: string, mensaje: string
) {
  await getResend().emails.send({
    from: FROM, to: ADMIN, reply_to: email,
    subject: `Nuevo contacto: ${asunto || nombre}`,
    html: contactNotificationHtml(nombre, email, asunto, mensaje),
  });
  // Confirmación al cliente
  return getResend().emails.send({
    from: FROM, to: email,
    subject: `Recibimos tu mensaje — ${process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda'}`,
    html: contactConfirmationHtml(nombre, asunto),
  });
}

/** Avisa al admin que un cliente pidió "Avísame cuando haya stock". No rompe
 *  el flujo del cliente si falla: se llama con .catch(console.error) desde
 *  la ruta, igual que sendContactMessageEmail. */
export async function sendStockNotifyAdminEmail(productName: string, customerEmail: string, productUrl: string) {
  if (!ADMIN) return;
  return getResend().emails.send({
    from: FROM, to: ADMIN, reply_to: customerEmail,
    subject: `Piden aviso de stock: ${productName}`,
    html: stockNotifyAdminHtml(productName, customerEmail, productUrl),
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** Notifica al admin sobre cualquier cambio de estado de un pedido */
export async function sendAdminOrderStatusEmail(order: Order, evento: string) {
  if (!ADMIN) return;
  return getResend().emails.send({
    from: FROM, to: ADMIN,
    subject: `[Admin] ${evento} — Pedido #${order.id.slice(0,8).toUpperCase()}`,
    html: adminOrderNotificationHtml(order, evento),
  });
}
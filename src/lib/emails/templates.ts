import type { Order } from '@/types';
import { ORDER_STATUS_LABELS, getCashCouponExpiry } from '@/utils';

const BRAND_COLOR = '#2c4270';
const TIENDA      = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL       ?? '';

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
}

// ✅ FIX: estos templates arman el HTML del email pegando strings — a
// diferencia de un componente React, acá nada se escapa solo. Cualquier
// campo que haya escrito el cliente (nombre, notas, mensaje de
// contacto...) hay que pasarlo por esto antes de insertarlo, o alguien
// podría cargar algo como '<img src=x onerror=...>' como su nombre en el
// checkout y que viaje intacto dentro del email que recibe el admin.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function base(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="background:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;"><p style="margin:0;color:#fff;font-size:22px;font-weight:800;">${TIENDA}</p></td></tr>
<tr><td style="background:#ffffff;padding:36px 32px;border-radius:0 0 12px 12px;">${body}</td></tr>
<tr><td style="padding:20px 32px;text-align:center;"><p style="margin:0;color:#9ca3af;font-size:12px;">${TIENDA} · <a href="${APP_URL}" style="color:${BRAND_COLOR};text-decoration:none;">${APP_URL.replace('https://','')}</a></p></td></tr>
</table></td></tr></table></body></html>`;
}

// ─── Confirmación de orden ────────────────────────────────────────────────────

export function orderConfirmationHtml(order: Order): string {
  const itemRows = (order.order_items ?? []).map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
        ${item.nombre_snap}<span style="color:#9ca3af;font-size:12px;display:block;">${item.tipo_pack === 'media_docena' ? 'Media docena (6 uds)' : 'Docena (12 uds)'} × ${item.cantidad_packs}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;text-align:right;font-weight:600;">${formatARS(item.subtotal)}</td>
    </tr>`).join('');

  const body = `
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;">¡Gracias por tu compra!</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hola <strong style="color:#374151;">${esc(order.nombre)}</strong>, tu pedido fue confirmado.</p>
    <div style="background:#fdf8f0;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">Número de pedido</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:${BRAND_COLOR};font-family:monospace;">#${order.id.slice(0,8).toUpperCase()}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tbody>${itemRows}</tbody></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="padding:5px 0;font-size:14px;color:#6b7280;">Subtotal</td><td style="text-align:right;font-size:14px;">${formatARS(order.subtotal)}</td></tr>
      <tr><td style="padding:5px 0;font-size:14px;color:#6b7280;">Envío</td><td style="text-align:right;font-size:14px;">${formatARS(order.costo_envio)}</td></tr>
      <tr><td style="padding:10px 0 0;font-size:16px;font-weight:700;border-top:2px solid #f3f4f6;">Total</td><td style="padding:10px 0 0;font-size:18px;font-weight:800;color:${BRAND_COLOR};text-align:right;border-top:2px solid #f3f4f6;">${formatARS(order.total)}</td></tr>
    </table>
    ${order.tipo_entrega === 'retiro' && order.codigo_retiro && ['pagado','procesando','enviado','entregado'].includes(order.estado) ? `
    <!-- Código de retiro — aparece solo en pedidos con retiro en local -->
    <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:14px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1px;">
        🏪 Tu código de retiro
      </p>
      <p style="margin:0;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:0.25em;color:#15803d;">
        ${order.codigo_retiro}
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#166534;">
        Presentá este código junto con tu DNI en el local para retirar tu pedido${
          order.retiro_retira_tercero
            ? ` (o que lo haga ${esc(order.retiro_tercero_nombre)} con su propio DNI, tal como lo indicaste)`
            : ''
        }.
      </p>
    </div>` : ''}
    <div style="text-align:center;"><a href="${APP_URL}/mis-pedidos" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">Ver mi pedido</a></div>`;

  return base(`Pedido #${order.id.slice(0,8).toUpperCase()} confirmado`, body);
}

// ─── Estado actualizado ───────────────────────────────────────────────────────

export function orderStatusHtml(order: Order): string {
  const msgs: Record<string, string> = {
    pagado: 'Tu pago fue confirmado. Estamos preparando tu pedido.',
    procesando: 'Estamos preparando tu pedido.',
    enviado: 'Tu pedido está en camino. ¡Pronto llegará!',
    entregado: '¡Tu pedido fue entregado exitosamente!',
    cancelado: 'Tu pedido fue cancelado. Si tenés dudas, contactanos.',
    rechazado: 'No pudimos validar el comprobante de tu pedido.',
    pendiente_pago: 'Tu cupón de pago en efectivo fue generado.',
  };

  const body = `
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#111827;">Actualización de tu pedido</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Hola <strong style="color:#374151;">${esc(order.nombre)}</strong>,</p>
    <div style="background:#fdf8f0;border-left:4px solid ${BRAND_COLOR};padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;">Estado actual</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:${BRAND_COLOR};">${ORDER_STATUS_LABELS[order.estado] ?? order.estado}</p>
    </div>
    <p style="font-size:15px;color:#374151;margin:0 0 8px;line-height:1.6;">${msgs[order.estado] ?? 'El estado de tu pedido fue actualizado.'}</p>
    ${order.rejection_reason ? `<p style="font-size:14px;color:#b91c1c;margin:0 0 20px;line-height:1.6;"><strong>Motivo:</strong> ${esc(order.rejection_reason)}</p>` : ''}
    <p style="font-size:13px;color:#9ca3af;margin:${order.rejection_reason ? '0' : '20px'} 0 24px;">Pedido <strong style="color:#374151;font-family:monospace;">#${order.id.slice(0,8).toUpperCase()}</strong> · Total: <strong style="color:#374151;">${formatARS(order.total)}</strong></p>
    <div style="text-align:center;"><a href="${APP_URL}/mis-pedidos" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">Ver mi pedido</a></div>`;

  return base(`Tu pedido está ${ORDER_STATUS_LABELS[order.estado]?.toLowerCase() ?? 'actualizado'}`, body);
}

// ─── Contacto ─────────────────────────────────────────────────────────────────

export function contactNotificationHtml(nombre: string, email: string, asunto: string, mensaje: string): string {
  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">Nuevo mensaje de contacto</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Recibiste un mensaje a través del formulario.</p>
    <table width="100%" style="margin-bottom:20px;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#9ca3af;width:80px;">De</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;">${esc(nombre)} &lt;${esc(email)}&gt;</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">Asunto</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;">${esc(asunto) || '(sin asunto)'}</td></tr>
    </table>
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${esc(mensaje)}</p>
    </div>
    <a href="mailto:${email}?subject=Re: ${encodeURIComponent(asunto ?? '')}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;">Responder a ${esc(nombre)}</a>`;

  return base(`Nuevo mensaje: ${esc(asunto) || esc(nombre)}`, body);
}

// ─── NUEVO: Aviso al admin — alguien pidió "Avísame cuando haya stock" ───────

export function stockNotifyAdminHtml(productName: string, email: string, productUrl: string): string {
  const body = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">Nueva solicitud de stock</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Un cliente quiere que le avisen cuando este producto vuelva a tener stock.</p>
    <table width="100%" style="margin-bottom:24px;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#9ca3af;width:100px;">Producto</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;">${esc(productName)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">Email</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;">${esc(email)}</td></tr>
    </table>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Cuando cargues stock nuevo para este producto desde el panel de admin, se le va a avisar automáticamente por email — no hace falta que le escribas vos.</p>
    <a href="${productUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;">Ver producto</a>`;

  return base(`Nueva solicitud de stock: ${esc(productName)}`, body);
}

// ─── NUEVO: Cupón de pago en efectivo ────────────────────────────────────────

export function cashPaymentPendingHtml(order: Order): string {
  const expiryDate  = getCashCouponExpiry(order.created_at);
  const orderNumber = order.id.slice(0, 8).toUpperCase();

  const steps = [
    ['1', 'Revisá tu email de Mercado Pago', 'Te enviaron el cupón con el código de barras para pagar.'],
    ['2', 'Andá a un punto de pago habilitado', 'Rapipago, Pago Fácil, Provincia NET, Cobroexpress y otros.'],
    ['3', `Pagá exactamente ${formatARS(order.total)}`, 'Mostrá el código y abonalo en efectivo.'],
    ['4', 'Tu pedido se confirma solo', 'Una vez acreditado, te enviamos un email de confirmación.'],
  ];

  const stepsHtml = steps.map(([num, title, desc]) => `
    <tr>
      <td style="width:36px;vertical-align:top;padding:0 12px 16px 0;">
        <div style="width:28px;height:28px;background:${BRAND_COLOR};border-radius:50%;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:800;">${num}</div>
      </td>
      <td style="vertical-align:top;padding-bottom:16px;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${title}</p>
        <p style="margin:3px 0 0;font-size:13px;color:#6b7280;">${desc}</p>
      </td>
    </tr>`).join('');

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:48px;">🧾</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;text-align:center;">¡Cupón generado!</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;text-align:center;line-height:1.6;">
      Hola <strong style="color:#374151;">${esc(order.nombre)}</strong>,<br>tu pedido está reservado. Completá el pago en efectivo para confirmarlo.
    </p>

    <div style="background:#fdf8f0;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:16px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Número de pedido</p>
      <p style="margin:0;font-size:24px;font-weight:900;color:${BRAND_COLOR};font-family:monospace;">#${orderNumber}</p>
      <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#111827;">Total: ${formatARS(order.total)}</p>
    </div>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#9a3412;font-weight:700;">⚠️ El cupón vence el ${expiryDate}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#c2410c;">Si no pagás antes, el pedido se cancelará automáticamente.</p>
    </div>

    <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 16px;">¿Qué hacer ahora?</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tbody>${stepsHtml}</tbody></table>

    <div style="text-align:center;">
      <a href="${APP_URL}/mis-pedidos" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">Ver estado de mi pedido</a>
    </div>`;

  return base(`Cupón generado — Pedido #${orderNumber}`, body);
}

// ─── Confirmación al cliente tras formulario de contacto ─────────────────────

export function contactConfirmationHtml(nombre: string, asunto: string): string {
  const BRAND_COLOR = '#2c4270';
  const TIENDA = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">¡Recibimos tu mensaje!</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hola <strong style="color:#374151;">${esc(nombre)}</strong>,<br>
      Tu consulta sobre <em>"${esc(asunto) || 'tu mensaje'}"</em> fue recibida correctamente.
      Te responderemos a la brevedad.
    </p>
    <div style="background:#fdf8f0;border-left:4px solid ${BRAND_COLOR};padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#374151;">
        Mientras tanto, podés revisar nuestras <a href="${APP_URL}/faq" style="color:${BRAND_COLOR};">preguntas frecuentes</a>
        o contactarnos por WhatsApp si tu consulta es urgente.
      </p>
    </div>
    <div style="text-align:center;">
      <a href="${APP_URL}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
        Ir a la tienda
      </a>
    </div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Mensaje recibido</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;"><p style="margin:0;color:#fff;font-size:22px;font-weight:800;">${TIENDA}</p></td></tr>
<tr><td style="background:#fff;padding:36px 32px;border-radius:0 0 12px 12px;">${body}</td></tr>
</table></td></tr></table></body></html>`;
}

// ─── Notificación al admin sobre cambio de estado de pedido ──────────────────

export function adminOrderNotificationHtml(order: Order, evento: string): string {
  const BRAND_COLOR = '#2c4270';
  const TIENDA = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

  function formatARS(n: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
  }

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">${evento}</h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Hay actividad en un pedido que requiere tu atención.</p>
    <div style="background:#fdf8f0;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;">Pedido</p>
      <p style="margin:0;font-size:20px;font-weight:900;color:${BRAND_COLOR};font-family:monospace;">#${order.id.slice(0,8).toUpperCase()}</p>
    </div>
    <table width="100%" style="margin-bottom:20px;font-size:14px;">
      <tr><td style="padding:6px 0;color:#6b7280;">Cliente</td><td style="font-weight:600;">${esc(order.nombre)} &lt;${esc(order.email)}&gt;</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Estado</td><td style="font-weight:600;text-transform:capitalize;">${order.estado}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Pago</td><td style="font-weight:600;text-transform:capitalize;">${order.metodo_pago}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Total</td><td style="font-weight:700;color:${BRAND_COLOR};">${formatARS(order.total)}</td></tr>
    </table>
    <div style="text-align:center;">
      <a href="${APP_URL}/admin/pedidos" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
        Ver pedidos en el panel
      </a>
    </div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${evento}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;"><p style="margin:0;color:#fff;font-size:22px;font-weight:800;">[Admin] ${TIENDA}</p></td></tr>
<tr><td style="background:#fff;padding:36px 32px;border-radius:0 0 12px 12px;">${body}</td></tr>
</table></td></tr></table></body></html>`;
}

// ─── Pedido expirado por falta de pago (REGLA DE NEGOCIO 3) ───────────────────

export function orderExpiredHtml(order: Order): string {
  const BRAND_COLOR = '#dc2626';
  const TIENDA = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

  function formatARS(n: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
  }

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:48px;">⏰</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;text-align:center;">
      Tu pedido expiró
    </h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;text-align:center;line-height:1.6;">
      Hola <strong style="color:#374151;">${esc(order.nombre)}</strong>,<br>
      no recibimos tu pago dentro del tiempo límite, así que tu pedido fue cancelado automáticamente.
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Pedido cancelado</p>
      <p style="margin:0;font-size:22px;font-weight:900;color:${BRAND_COLOR};font-family:monospace;">#${order.id.slice(0,8).toUpperCase()}</p>
      <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#111827;">${formatARS(order.total)}</p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;">
        ✅ Los productos volvieron a estar disponibles en la tienda
      </p>
      <p style="margin:4px 0 0;font-size:13px;color:#166534;">
        Si todavía te interesan, podés volver a comprarlos — recordá que el stock es limitado.
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
        Volver a comprar
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Si ya realizaste el pago y creés que esto es un error, contactanos en
      <a href="${APP_URL}/contacto" style="color:${BRAND_COLOR};">nuestro sitio</a>.
    </p>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pedido expirado</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;"><p style="margin:0;color:#fff;font-size:22px;font-weight:800;">${TIENDA}</p></td></tr>
<tr><td style="background:#fff;padding:36px 32px;border-radius:0 0 12px 12px;">${body}</td></tr>
</table></td></tr></table></body></html>`;
}

// ─── Reembolso automático por doble venta (sin stock disponible) ────────────

export function orderRefundedHtml(order: Order, refundAmount?: number): string {
  const BRAND_COLOR = '#dc2626';
  const TIENDA = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

  function formatARS(n: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
  }

  const body = `
    <div style="text-align:center;margin-bottom:24px;"><span style="font-size:48px;">💳</span></div>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;text-align:center;">
      Reembolsamos tu pago
    </h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;text-align:center;line-height:1.6;">
      Hola <strong style="color:#374151;">${esc(order.nombre)}</strong>,<br>
      lamentablemente el producto de tu pedido se agotó por una coincidencia de horarios
      justo cuando se procesaba tu pago. Ya iniciamos el reembolso completo.
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Pedido</p>
      <p style="margin:0;font-size:20px;font-weight:900;color:${BRAND_COLOR};font-family:monospace;">#${order.id.slice(0,8).toUpperCase()}</p>
      <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#111827;">
        Monto reembolsado: ${formatARS(refundAmount ?? order.total)}
      </p>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#1e40af;">
        El reembolso puede tardar hasta 10 días hábiles en verse reflejado en tu resumen,
        según tu medio de pago y entidad bancaria.
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${APP_URL}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
        Ver otros productos
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Disculpá las molestias. Si tenés alguna duda, contactanos en
      <a href="${APP_URL}/contacto" style="color:${BRAND_COLOR};">nuestro sitio</a>.
    </p>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reembolso procesado</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:${BRAND_COLOR};border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;"><p style="margin:0;color:#fff;font-size:22px;font-weight:800;">${TIENDA}</p></td></tr>
<tr><td style="background:#fff;padding:36px 32px;border-radius:0 0 12px 12px;">${body}</td></tr>
</table></td></tr></table></body></html>`;
}
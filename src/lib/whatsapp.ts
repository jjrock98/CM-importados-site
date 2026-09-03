import type { Order } from '@/types';

/**
 * Arma el link de WhatsApp (wa.me) con un mensaje pre-armado según el
 * estado del pedido, para que el admin le avise al cliente con un solo
 * clic — sin tener que escribir el mensaje a mano cada vez.
 *
 * No es un envío automático (no hay integración con la API de WhatsApp
 * Business, que requiere cuenta de Meta Business aprobada): esto abre
 * WhatsApp Web/App con el chat y el texto ya listos, el admin solo
 * confirma el envío. Encaja con cómo ya se usa WhatsApp en el resto del
 * sitio (ver ProductWhatsAppButton).
 */
export function buildOrderWhatsAppLink(order: Order): string | null {
  const telefono = order.telefono?.replace(/\D/g, '');
  if (!telefono) return null;

  const nombre = order.nombre?.split(' ')[0] || '';
  const codigoPedido = `#${order.id.slice(0, 8).toUpperCase()}`;
  const esRetiro = order.tipo_entrega === 'retiro';
  const listoParaRetirar = esRetiro && order.codigo_retiro && ['pagado', 'procesando', 'enviado'].includes(order.estado);

  let mensaje = '';

  switch (order.estado) {
    case 'pendiente':
    case 'pendiente_pago':
      mensaje = `Hola ${nombre}! Te escribimos por tu pedido ${codigoPedido}, todavía está pendiente de pago. Cualquier consulta, contanos 🙂`;
      break;
    case 'pagado':
      mensaje = `Hola ${nombre}! Te confirmamos que recibimos el pago de tu pedido ${codigoPedido} 🎉 Ya lo estamos preparando.`;
      break;
    case 'procesando':
      mensaje = `Hola ${nombre}! Tu pedido ${codigoPedido} ya está en preparación 📦`;
      break;
    case 'enviado':
      mensaje = esRetiro
        ? `Hola ${nombre}! Tu pedido ${codigoPedido} ya está listo.`
        : `Hola ${nombre}! Tu pedido ${codigoPedido} ya salió. En breve te contactamos para coordinar la entrega 🚚`;
      break;
    case 'entregado':
      mensaje = `Gracias por tu compra ${nombre}! Tu pedido ${codigoPedido} ya fue entregado. Cualquier cosa, estamos a disposición 🙌`;
      break;
    case 'cancelado':
      mensaje = `Hola ${nombre}, te escribimos por tu pedido ${codigoPedido} que quedó cancelado. Cualquier consulta, contactanos.`;
      break;
    default:
      mensaje = `Hola ${nombre}! Te escribimos por tu pedido ${codigoPedido}.`;
  }

  if (listoParaRetirar) {
    mensaje += ` Ya podés pasar a retirarlo por el local con el código ${order.codigo_retiro} y tu DNI`;
    mensaje += order.retiro_retira_tercero
      ? ` (o puede pasar ${order.retiro_tercero_nombre} con el suyo, tal como nos indicaron).`
      : '.';
  }

  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

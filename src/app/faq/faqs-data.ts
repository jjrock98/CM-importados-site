// Datos puros, SIN 'use client'. Los importan tanto FaqAccordion.tsx
// ('use client', para el acordeón interactivo) como page.tsx (Server
// Component, para armar el JSON-LD FAQPage).
//
// ⚠️ Por qué está en su propio archivo y no exportado desde
// FaqAccordion.tsx: un Server Component (page.tsx) que importa un valor
// (no un componente) desde un módulo marcado 'use client' no tiene
// garantizado recibir ese valor real en el servidor — React Server
// Components solo trata como "referencia de cliente" a los componentes
// exportados de un módulo 'use client', no a constantes sueltas. Eso
// provocaba exactamente el error de build: `FAQS.map is not a function`,
// porque en el server FAQS no llegaba como el array real. Al vivir en un
// archivo sin directiva, ambos lados importan la misma data real.
export interface Faq { q: string; a: string }

export const FAQS: Faq[] = [
  { q: '¿Cómo funcionan los packs?', a: 'Vendemos en packs cerrados por docena (12 unidades). Aunque, algunos productos se venden por media docena (6 unidades). Al seleccionar un producto podés elegir el tipo de pack y la cantidad de la misma.' },
  { q: '¿Se realizan envíos?', a: 'El envio se acordara mediante los canales de comunicación o en persona. Lo hacemos por Via Cargo, Andreani y Correo Argentino. El costo varía según la zona de entrega y la empresa de transporte elegida.' },
  { q: '¿Cuáles son los métodos de pago?', a: 'Aceptamos Mercado Pago (débito, crédito y efectivo) y transferencia bancaria. Para transferencia podés subir el comprobante desde tu cuenta. Siempre recuerda que hay un descuento con el pago en efectivo fisico y transferencia.' },
  { q: '¿El pago con Mercado Pago es seguro?', a: 'Sí. Al confirmar tu pedido se abre una ventana segura de Mercado Pago donde completás el pago. Nosotros nunca vemos los datos de tu tarjeta.' },
  { q: '¿Cuánto tarda en llegar mi pedido?', a: 'Los tiempos de entrega dependen de tu zona. Generalmente entre 3 y 7 días hábiles. Lo confirmamos al procesar tu pedido.' },
  { q: '¿Puedo cambiar o cancelar mi pedido?', a: 'Podés cancelar tu pedido mientras esté en estado "Pendiente" desde la sección Mis Pedidos, siempre que el pago no haya sido procesado. Una vez confirmado el pago ya no es posible cancelarlo. Contactanos a la brevedad si necesitás ayuda.' },
  { q: '¿Aceptan cambios o devoluciones?', a: 'Aceptamos cambios únicamente por defecto de fábrica. Tenés 3 días desde que recibís tu pedido para reportarnos el defecto (por WhatsApp o desde Contacto, adjuntando fotos del producto) y coordinamos el cambio. No se aceptan cambios por otro motivo (talle, color, arrepentimiento de compra, etc.).' },
  { q: '¿Hacen envíos a todo el país?', a: 'Sí, enviamos a todo el territorio nacional. El costo varía según la zona de entrega y la empresa de transporte elegida.' },
  { q: '¿Cómo sé el estado de mi pedido?', a: 'En "Mis Pedidos" podés ver el estado actualizado en tiempo real. También te avisamos por email ante cada cambio.' },
  { q: '¿Qué hago si mi pago no fue confirmado?', a: 'Para pagos por transferencia, asegurate de subir el comprobante desde Mis Pedidos. Para Mercado Pago, si el monto fue debitado pero el pedido no se actualizó, contactanos.' },
  { q: '¿Que metodo de pago es preferible?', a: 'En preferencia trabajamos con transferencia bancaria y el pago en efectivo en el local. Siempre hay un descuento al cliente por estos medios.' },
];
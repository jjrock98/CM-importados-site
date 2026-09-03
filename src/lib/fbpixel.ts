/**
 * Facebook Pixel — helpers tipados para disparar eventos de conversión.
 *
 * Los eventos se disparan del lado del cliente (browser only).
 * Sin `NEXT_PUBLIC_FB_PIXEL_ID` configurado, todas las funciones
 * son no-ops silenciosos — nunca rompen la app.
 *
 * Eventos implementados:
 *  - PageView      → automático en layout.tsx (ya configurado)
 *  - AddToCart     → cuando el cliente agrega un producto al carrito
 *  - InitiateCheckout → cuando entra a /checkout
 *  - Purchase      → cuando el pedido se confirma exitosamente
 *  - ViewContent   → cuando ve la página de un producto
 */

// Tipado del objeto fbq global inyectado por el snippet del layout
declare global {
  interface Window {
    fbq?: (event: string, name: string, params?: Record<string, unknown>) => void;
  }
}

function fbq(event: string, name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq(event, name, params);
}

export function pixelAddToCart(params: {
  contentIds:   string[];
  contentName:  string;
  value:        number;
  currency?:    string;
  contentType?: string;
}) {
  fbq('track', 'AddToCart', {
    content_ids:  params.contentIds,
    content_name: params.contentName,
    content_type: params.contentType ?? 'product',
    value:        params.value,
    currency:     params.currency ?? 'ARS',
  });
}

export function pixelViewContent(params: {
  contentId:   string;
  contentName: string;
  value?:      number;
  currency?:   string;
}) {
  fbq('track', 'ViewContent', {
    content_ids:  [params.contentId],
    content_name: params.contentName,
    content_type: 'product',
    value:        params.value,
    currency:     params.currency ?? 'ARS',
  });
}

export function pixelInitiateCheckout(params: {
  value:       number;
  numItems:    number;
  contentIds:  string[];
  currency?:   string;
}) {
  fbq('track', 'InitiateCheckout', {
    value:       params.value,
    num_items:   params.numItems,
    content_ids: params.contentIds,
    currency:    params.currency ?? 'ARS',
  });
}

export function pixelPurchase(params: {
  orderId:    string;
  value:      number;
  currency?:  string;
  contentIds: string[];
  numItems:   number;
}) {
  fbq('track', 'Purchase', {
    value:       params.value,
    currency:    params.currency ?? 'ARS',
    content_ids: params.contentIds,
    num_items:   params.numItems,
    order_id:    params.orderId,
    content_type:'product',
  });
}

export function pixelSearch(query: string) {
  fbq('track', 'Search', { search_string: query });
}

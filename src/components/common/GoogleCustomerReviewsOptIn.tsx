'use client';
import { useEffect } from 'react';
import { useCookieConsentStore } from '@/hooks/useCookieConsent';

// ID de la cuenta de Merchant Center (no es un secreto).
const MERCHANT_ID = Number(process.env.NEXT_PUBLIC_GOOGLE_MERCHANT_ID || 5877644903);
// Días desde la compra hasta la entrega estimada. Ajustar en Vercel con
// NEXT_PUBLIC_GCR_DELIVERY_DAYS según lo que realmente tarden en entregar:
// Google manda la encuesta al cliente DESPUÉS de esa fecha.
const DELIVERY_DAYS = Number(process.env.NEXT_PUBLIC_GCR_DELIVERY_DAYS || 3);

interface Gapi {
  load: (module: string, cb: () => void) => void;
  surveyoptin: { render: (opts: Record<string, unknown>) => void };
}
declare global {
  interface Window { renderOptIn?: () => void; gapi?: Gapi }
}

/**
 * Invitación a "Reseñas de Clientes de Google" para la página de pedido
 * confirmado. No dibuja nada propio: Google muestra su propio cuadro de
 * aceptación y recién ahí el cliente decide si quiere recibir la encuesta.
 *
 * Reglas que respeta:
 *  - Solo con consentimiento "Aceptar todo" (mismo criterio que GA, Pixel
 *    y Clarity): el email del cliente viaja a Google.
 *  - /pedido-confirmado recibe orderId y email por la URL, y cualquiera
 *    puede escribir una URL a mano. Antes de mostrar nada se verifica con
 *    /api/seguimiento (que exige que pedido y email coincidan) para que
 *    nadie pueda usar este formulario para mandar encuestas a emails ajenos.
 *  - No se invita en pedidos cancelados.
 */
export function GoogleCustomerReviewsOptIn({ orderId, email }: { orderId: string; email: string }) {
  const status = useCookieConsentStore((s) => s.status);

  useEffect(() => {
    if (status !== 'accepted' || !orderId || !email) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/seguimiento?id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`,
        );
        if (!res.ok || cancelled) return;
        const order = (await res.json()).data as
          | { id: string; email: string; estado: string; created_at: string }
          | undefined;
        if (!order || order.estado === 'cancelado') return;

        const delivery = new Date(order.created_at);
        delivery.setDate(delivery.getDate() + DELIVERY_DAYS);

        const render = () => {
          window.gapi?.load('surveyoptin', () => {
            window.gapi?.surveyoptin.render({
              merchant_id: MERCHANT_ID,
              order_id: order.id,
              email: order.email,
              delivery_country: 'AR',
              estimated_delivery_date: delivery.toISOString().slice(0, 10),
            });
          });
        };
        if (cancelled) return;
        if (window.gapi) return render(); // platform.js ya estaba cargado

        window.renderOptIn = render;
        const s = document.createElement('script');
        s.src = 'https://apis.google.com/js/platform.js?onload=renderOptIn';
        s.async = true;
        s.defer = true;
        document.body.appendChild(s);
      } catch {
        /* la invitación es opcional: si falla, no afecta la página */
      }
    })();

    return () => { cancelled = true; };
  }, [status, orderId, email]);

  return null;
}
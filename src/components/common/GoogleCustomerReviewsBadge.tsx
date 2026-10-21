'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCookieConsentStore } from '@/hooks/useCookieConsent';

const MERCHANT_ID = Number(process.env.NEXT_PUBLIC_GOOGLE_MERCHANT_ID || 5877644903);
const EXCLUDED_PREFIXES = ['/admin', '/auth', '/api', '/pedido-confirmado', '/seguimiento', '/mis-pedidos', '/checkout'];

declare global {
  interface Window { merchantwidget?: { start: (opts: Record<string, unknown>) => void } }
}

/**
 * Insignia de "Reseñas de Clientes de Google" con la puntuación del vendedor.
 *
 * Apagada por defecto: mientras no haya reseñas suficientes, Google muestra
 * "No hay puntuaciones disponibles", que en un sitio se ve mal. Para
 * encenderla: NEXT_PUBLIC_GCR_BADGE=true en Vercel + redeploy.
 * Solo con "Aceptar todo" en el banner de cookies (carga código de Google).
 */
export function GoogleCustomerReviewsBadge() {
  const status = useCookieConsentStore((s) => s.status);
  const pathname = usePathname() ?? '';
  const excluded = EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const enabled = process.env.NEXT_PUBLIC_GCR_BADGE === 'true' && status === 'accepted' && !excluded;

  useEffect(() => {
    if (!enabled || document.getElementById('merchantWidgetScript')) return;
    const s = document.createElement('script');
    s.id = 'merchantWidgetScript';
    s.src = 'https://www.gstatic.com/shopping/merchant/merchantwidget.js';
    s.defer = true;
    s.addEventListener('load', () => window.merchantwidget?.start({ merchant_id: MERCHANT_ID }));
    document.body.appendChild(s);
  }, [enabled]);

  return null;
}
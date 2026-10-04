'use client';
import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCookieConsentStore } from '@/hooks/useCookieConsent';

// ID de medición de GA4 (no es un secreto). Se puede sobrescribir con
// NEXT_PUBLIC_GA_MEASUREMENT_ID en Vercel.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-9P0TECHGHB';

// El tráfico interno (panel admin, login) no se mide.
const EXCLUDED_PREFIXES = ['/admin', '/auth', '/api'];

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4. Mismo criterio que FacebookPixelLoader y ClarityLoader:
 * solo se monta si el visitante eligió "Aceptar todo" en el banner de cookies.
 *
 * Los page_view se mandan a mano (send_page_view: false) con la URL SIN query
 * string: /pedido-confirmado lleva el email del cliente en la URL y no puede
 * viajar a Google Analytics.
 */
export function GoogleAnalytics() {
  const status = useCookieConsentStore((s) => s.status);
  const pathname = usePathname() ?? '';

  const excluded = EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const enabled = !!GA_ID && status === 'accepted' && !excluded;

  useEffect(() => {
    if (!enabled) return;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        // gtag.js espera objetos `arguments`, no arrays.
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, { send_page_view: false });
    }
    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: window.location.origin + pathname,
      page_title: document.title,
    });
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      strategy="afterInteractive"
    />
  );
}
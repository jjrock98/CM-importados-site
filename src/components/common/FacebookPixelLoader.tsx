'use client';
import Script from 'next/script';
import { useCookieConsentStore } from '@/hooks/useCookieConsent';

/**
 * ✅ FIX: este script antes vivía embebido directo en layout.tsx y se
 * cargaba SIEMPRE que `NEXT_PUBLIC_FB_PIXEL_ID` estuviera configurado —
 * sin mirar para nada la elección del banner de cookies. Alguien que
 * tocaba "Solo esenciales" terminaba con el Pixel de Meta corriendo
 * igual. Ahora solo se monta el <Script> cuando el visitante aceptó
 * expresamente ("Aceptar todo" en CookieConsent.tsx).
 *
 * Si el visitante ya había elegido "Solo esenciales" o todavía no
 * eligió nada, este componente no renderiza nada — cero tracking.
 */
export function FacebookPixelLoader() {
  const status = useCookieConsentStore((s) => s.status);
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  if (!pixelId || status !== 'accepted') return null;

  return (
    <Script id="fb-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
    </Script>
  );
}
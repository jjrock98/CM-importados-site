'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useCookieConsentStore } from '@/hooks/useCookieConsent';

// Project ID de Clarity (no es un secreto: viaja en el HTML público).
// Se puede sobrescribir con NEXT_PUBLIC_CLARITY_PROJECT_ID en Vercel.
const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || 'ys7kd7lugk';

// Páginas con datos personales: nunca se graban.
const EXCLUDED_PREFIXES = [
  '/admin', '/auth', '/api', '/checkout', '/carrito', '/perfil',
  '/completar-perfil', '/mis-pedidos', '/seguimiento', '/pedido-confirmado',
  '/pago', '/pago-exitoso', '/subir-comprobante', '/eliminar-datos',
];

/**
 * Microsoft Clarity (mapas de calor + grabaciones de sesión).
 * Mismo criterio que FacebookPixelLoader: solo se monta si el visitante
 * eligió "Aceptar todo" en el banner de cookies. Si no hay ID, no
 * renderiza nada.
 */
export function ClarityLoader() {
  const status = useCookieConsentStore((s) => s.status);
  const pathname = usePathname() ?? '';

  if (!CLARITY_PROJECT_ID) return null;
  if (status !== 'accepted') return null;
  if (EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_PROJECT_ID}");`}
    </Script>
  );
}
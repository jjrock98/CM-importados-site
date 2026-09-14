'use client';
import { Cookie, X } from 'lucide-react';
import Link from 'next/link';
import { useCookieConsentStore } from '@/hooks/useCookieConsent';

/**
 * Banner de consentimiento de cookies.
 *
 * ✅ FIX: antes guardaba la elección en localStorage pero NUNCA la
 * usaba para nada — el Pixel de Meta (src/lib/fbpixel.ts) se cargaba
 * igual para todos desde layout.tsx, sin importar si el visitante
 * tocaba "Aceptar" o "Solo esenciales". El texto de acá y el de
 * /politicas decían "no usamos cookies de seguimiento de terceros",
 * lo cual era falso mientras el Pixel esté configurado.
 *
 * Ahora la elección vive en useCookieConsentStore (persistida) y
 * FacebookPixelLoader.tsx la lee de ahí: el Pixel solo se carga si el
 * visitante eligió "Aceptar todo".
 */
export function CookieConsent() {
  const status  = useCookieConsentStore((s) => s.status);
  const accept  = useCookieConsentStore((s) => s.accept);
  const reject  = useCookieConsentStore((s) => s.rejectMarketing);

  if (status !== 'unknown') return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm animate-slide-up"
    >
      <div className="card border border-border shadow-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Cookie size={18} className="text-brand-500 shrink-0" />
            <p className="text-sm font-semibold">Cookies y privacidad</p>
          </div>
          <button onClick={reject} className="text-muted hover:text-foreground transition-colors shrink-0" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted leading-relaxed mb-4">
          Usamos cookies esenciales para el carrito y la sesión. Si aceptás,
          también activamos el píxel de Meta (Facebook/Instagram) para medir
          la efectividad de nuestros anuncios.{' '}
          <Link href="/politicas" className="text-brand-600 hover:underline">Ver política de privacidad</Link>.
        </p>

        <div className="flex gap-2">
          <button onClick={accept} className="btn-primary flex-1 py-2 text-xs">
            Aceptar todo
          </button>
          <button onClick={reject} className="btn-secondary flex-1 py-2 text-xs">
            Solo esenciales
          </button>
        </div>
      </div>
    </div>
  );
}
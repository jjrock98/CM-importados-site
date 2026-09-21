'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useCookieConsentStore } from '@/hooks/useCookieConsent';

// ── Config ────────────────────────────────────────────────────────────────
const SHOW_DELAY_MS   = 5000;              // espera 5s DESPUÉS de la primera interacción real
const COOLDOWN_DAYS   = 14;                // si lo cierra, no lo vuelve a ver por 14 días
const STORAGE_KEY      = 'whatsapp-group-popup-dismissed-at';
const CONVERTED_KEY   = 'whatsapp-group-popup-converted';

// Rutas donde no tiene sentido mostrarlo: panel admin (uso interno) y el
// flujo de compra (checkout/carrito) — no se interrumpe a alguien que ya
// está pagando con un cartel de marketing.
function isExcludedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/carrito')
  );
}

/**
 * Popup de captura de leads (lead magnet): invita a sumarse al grupo/canal
 * de WhatsApp. Pensado para revendedores — quieren enterarse rápido de lo
 * que entra al local.
 *
 * Nada de framer-motion acá a propósito: es el mismo espíritu que ya usa
 * CartDrawer.tsx (transiciones CSS simples con Tailwind) — un popup de
 * marketing no debería sumar peso de JS a costa del rendimiento que se
 * vino optimizando en el resto del sitio.
 *
 * No usa next/dynamic tampoco: el componente entero no renderiza nada
 * visible hasta pasado SHOW_DELAY_MS, así que no compite con el LCP ni con
 * la hidratación inicial aunque esté montado desde el layout raíz.
 */
export function WhatsAppGroupPopup() {
  const pathname = usePathname();
  const groupLink = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_LINK;

  const [dismissedAt, setDismissedAt] = useLocalStorage<number | null>(STORAGE_KEY, null);
  const [converted, setConverted]     = useLocalStorage<boolean>(CONVERTED_KEY, false);

  const consentStatus = useCookieConsentStore((s) => s.status);

  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => setHasMounted(true), []);

  // ✅ FIX: antes el popup se abría solo a los 5s de cargar la página. Eso
  // traía dos problemas:
  //  1) Tapaba el banner de cookies (el popup es z-[110] con fondo oscuro a
  //     pantalla completa; el banner es z-50): la persona no podía aceptar
  //     ni rechazar hasta cerrar el popup.
  //  2) PageSpeed/Lighthouse espera varios segundos antes de medir, así que
  //     auditaba la página CON el popup abierto (body en overflow:hidden y
  //     todo oscurecido) — eso contaminaba la auditoría de contraste.
  // Ahora solo se muestra cuando (a) la persona ya eligió en el banner de
  // cookies y (b) hubo una interacción real (scroll, toque, click o tecla).
  // Un robot de auditoría no interactúa, así que nunca lo ve.
  useEffect(() => {
    if (hasInteracted) return;
    const events = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const;
    const onFirst = () => {
      events.forEach((e) => window.removeEventListener(e, onFirst));
      setHasInteracted(true);
    };
    events.forEach((e) => window.addEventListener(e, onFirst, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onFirst));
  }, [hasInteracted]);

  useEffect(() => {
    if (!groupLink || !hasMounted) return;
    if (consentStatus === 'unknown') return; // primero que resuelva el banner de cookies
    if (!hasInteracted) return;
    if (isExcludedRoute(pathname)) return;
    if (converted) return; // ya se unió una vez — no lo molestamos más

    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < COOLDOWN_DAYS) return;
    }

    const timer = setTimeout(() => setIsOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [groupLink, hasMounted, pathname, converted, dismissedAt, consentStatus, hasInteracted]);

  // Cerrar con Escape + bloquear scroll de fondo mientras está abierto
  // (mismo patrón que CartDrawer.tsx)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleClose() {
    setIsOpen(false);
    setDismissedAt(Date.now());
  }

  function handleJoin() {
    setConverted(true);
    setIsOpen(false);
  }

  if (!groupLink || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Unite a nuestro grupo de WhatsApp">
      {/* Backdrop */}
      <div onClick={handleClose} className="absolute inset-0 bg-black/60 animate-fade-in" />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-2xl animate-slide-up-fade">
        <button
          onClick={handleClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 text-muted hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white">
          <MessageCircle size={26} strokeWidth={2.2} />
        </div>

        <h2 className="font-display text-lg font-bold">
          Unite a nuestro canal exclusivo de WhatsApp
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Para ver las novedades antes que nadie — ideal si comprás para revender.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <a
            href={groupLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleJoin}
            className="btn-primary w-full py-2.5 text-sm"
          >
            Unirme al grupo
          </a>
          <button onClick={handleClose} className="text-xs text-muted hover:text-foreground transition-colors py-1">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Estado del consentimiento de cookies, persistido en localStorage.
 *
 * 'unknown'   → todavía no eligió nada (se le muestra el banner).
 * 'accepted'  → aceptó todo, incluidas cookies de marketing/analítica de
 *               terceros (Meta Pixel).
 * 'essential' → solo cookies esenciales (login, carrito) — SIN Meta Pixel.
 *
 * Usa una clave nueva ('cookie-consent-v2') a propósito: la clave vieja
 * ('cookie-consent', en CookieConsent.tsx) guardaba la elección pero
 * nunca se usaba para bloquear nada — el Pixel de Meta se cargaba igual
 * para todos, hubieran aceptado o no. Como esa "aceptación" vieja no fue
 * un consentimiento real para el Pixel, no correspondía heredarla acá.
 */
export type CookieConsentStatus = 'unknown' | 'accepted' | 'essential';

interface CookieConsentStore {
  status: CookieConsentStatus;
  accept: () => void;
  rejectMarketing: () => void;
}

export const useCookieConsentStore = create<CookieConsentStore>()(
  persist(
    (set) => ({
      status: 'unknown',
      accept:          () => set({ status: 'accepted' }),
      rejectMarketing: () => set({ status: 'essential' }),
    }),
    { name: 'cookie-consent-v2' }
  )
);
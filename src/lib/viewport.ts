/**
 * Punto de corte "mobile/tablet" para decisiones de UI que solo deben
 * aplicarse en pantallas chicas (ej: panel de carrito tipo drawer).
 *
 * 768px coincide a propósito con el breakpoint `md` de Tailwind, que es
 * donde el Navbar del sitio ya pasa de su versión mobile (menú hamburguesa)
 * a la versión desktop — ver `md:hidden` / `md:block` en
 * src/components/layout/Navbar.tsx. Se reutiliza el mismo corte acá para
 * que "es mobile/tablet" signifique lo mismo en todo el sitio.
 */
export const MOBILE_TABLET_BREAKPOINT = 768;

/**
 * Solo se puede evaluar en el cliente (usa `window`). Se llama siempre
 * dentro de un event handler (click, submit, etc.), nunca durante el
 * render — así no hay riesgo de mismatch de hidratación SSR/cliente.
 */
export function isMobileOrTabletViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_TABLET_BREAKPOINT;
}
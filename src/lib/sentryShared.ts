import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

/**
 * Configuración común de Sentry (servidor, edge y navegador).
 *
 * Sentry queda COMPLETAMENTE APAGADO hasta que exista NEXT_PUBLIC_SENTRY_DSN
 * y se esté en producción: sin DSN no se carga el SDK ni se envía nada.
 * Solo se reportan errores (sin trazas de rendimiento ni grabación de sesión).
 *
 * Este archivo solo importa TIPOS de @sentry/nextjs, así que no suma nada al
 * bundle del navegador.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
export const sentryEnabled = process.env.NODE_ENV === 'production' && !!SENTRY_DSN;

/** Saca el query string de una URL (puede traer ?secret=... de los crons, emails, etc.). */
function sinQuery(url: string): string {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}

/**
 * Limpia cada evento ANTES de enviarlo: cookies, headers de autenticación,
 * query strings (los crons externos usan ?secret=<token>) y datos personales
 * del usuario (solo se conserva el id).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) event.request.url = sinQuery(event.request.url);
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/^(cookie|authorization|x-api-key|x-signature|x-forwarded-for)$/i.test(h)) {
          delete event.request.headers[h];
        }
      }
    }
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}

/** Descarta los avisos de consola (pueden contener datos personales) y limpia las URLs. */
export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.category === 'console') return null;
  if (b.data && typeof b.data.url === 'string') b.data.url = sinQuery(b.data.url);
  if (b.data && typeof b.data.to === 'string') b.data.to = sinQuery(b.data.to);
  if (b.data && typeof b.data.from === 'string') b.data.from = sinQuery(b.data.from);
  return b;
}

export const sentryBaseOptions = {
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  maxBreadcrumbs: 20,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
  // Ruido que no se puede arreglar desde el código del sitio.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    'Failed to fetch',
    'Load failed',
    'NetworkError when attempting to fetch resource.',
  ],
  // Errores que vienen de extensiones del navegador y de scripts de terceros.
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /tawk\.to/i,
    /googletagmanager\.com/i,
    /google-analytics\.com/i,
    /clarity\.ms/i,
    /connect\.facebook\.net/i,
  ],
};
import { SENTRY_DSN, sentryEnabled, sentryBaseOptions } from '@/lib/sentryShared';

type SentryModule = typeof import('@sentry/nextjs');

let cargando: Promise<SentryModule | null> | null = null;

/**
 * Descarga e inicializa el SDK de Sentry en el navegador, UNA sola vez y
 * recién cuando hace falta (el primer error). El SDK pesa unos 157 KB
 * comprimidos: cargarlo al abrir la página sumaba trabajo al hilo principal
 * y empeoraba PageSpeed. Devuelve `null` si Sentry está apagado.
 */
export function cargarSentry(): Promise<SentryModule | null> {
  if (!sentryEnabled) return Promise.resolve(null);
  cargando ??= import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({ dsn: SENTRY_DSN, ...sentryBaseOptions });
      return Sentry;
    })
    .catch(() => null);
  return cargando;
}

/** Reporta un error del navegador (carga el SDK si todavía no está). Nunca lanza. */
export function reportarErrorCliente(err: unknown): void {
  cargarSentry()
    .then((Sentry) => Sentry?.captureException(err))
    .catch(() => {});
}
import * as Sentry from '@sentry/nextjs';

/**
 * Reporta a Sentry un error que el código YA atrapó (por ejemplo, un webhook
 * que responde 200 igual para que Mercado Pago no reintente: sin esto, un
 * pago que no se procesó quedaría sin aviso). Solo servidor.
 *
 * Nunca lanza: si Sentry está apagado o falla, no pasa nada.
 * No pases datos personales en `extra` (emails, teléfonos): solo ids.
 */
export function reportError(
  err: unknown,
  area: string,
  extra?: Record<string, string | number | boolean | null | undefined>,
): void {
  try {
    Sentry.captureException(err, { tags: { area }, extra });
  } catch {
    /* monitoreo nunca debe romper una request */
  }
}
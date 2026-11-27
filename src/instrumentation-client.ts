import { sentryEnabled } from '@/lib/sentryShared';
import { reportarErrorCliente } from '@/lib/sentryClient';

/**
 * Sentry en el navegador: NO se descarga al abrir la página. Solo se escuchan
 * los errores (un par de líneas, sin costo) y el SDK se carga recién cuando
 * ocurre el primero, que se reporta en ese momento; a partir de ahí el SDK
 * captura los siguientes por su cuenta. Así no suma al JS inicial ni al hilo
 * principal (PageSpeed), y sin DSN no se hace nada.
 *
 * Los errores de carga de imágenes y recursos no llegan acá (no suben hasta
 * `window`), así que una imagen rota no dispara la descarga.
 */
if (sentryEnabled && typeof window !== 'undefined') {
  const alPrimerError = (err: unknown) => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRechazo);
    reportarErrorCliente(err);
  };
  const onError = (e: ErrorEvent) => alPrimerError(e.error ?? e.message);
  const onRechazo = (e: PromiseRejectionEvent) => alPrimerError(e.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRechazo);
}

export {};
import { SENTRY_DSN, sentryEnabled, sentryBaseOptions } from '@/lib/sentryShared';

/**
 * Sentry en el navegador, cargado de forma DIFERIDA: el SDK se descarga recién
 * cuando la página terminó de cargar y el navegador está ocioso, así que no
 * compite con el LCP ni suma al JS inicial (el sitio viene optimizado para
 * PageSpeed). Sin DSN no se descarga nada.
 */
if (sentryEnabled && typeof window !== 'undefined') {
  const iniciar = () => {
    import('@sentry/nextjs')
      .then((Sentry) => Sentry.init({ dsn: SENTRY_DSN, ...sentryBaseOptions }))
      .catch(() => {});
  };
  const programar = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(iniciar, { timeout: 5000 });
    else setTimeout(iniciar, 3000);
  };
  if (document.readyState === 'complete') programar();
  else window.addEventListener('load', programar, { once: true });
}

export {};
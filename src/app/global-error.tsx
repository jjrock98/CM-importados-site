'use client';

import { useEffect } from 'react';

// Última red de seguridad: errores que rompen el layout raíz (error.tsx no los
// alcanza). Reemplaza TODO el documento, por eso trae su propio <html> y usa
// estilos en línea (no depende de Tailwind ni del layout).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error (layout raíz):', error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error)).catch(() => {});
    }
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          fontFamily: 'system-ui, sans-serif', textAlign: 'center', color: '#18181b',
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Algo salió mal</h1>
        <p style={{ maxWidth: 360, fontSize: 14, color: '#71717a', margin: 0 }}>
          Ocurrió un error inesperado. Podés intentar de nuevo o volver al inicio.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={reset}
            style={{ padding: '10px 20px', borderRadius: 12, border: 0, background: '#18181b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Reintentar
          </button>
          {/* <a> a propósito: si el layout raíz falló, hace falta una recarga completa (next/link no sirve acá). */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #d4d4d8', color: '#18181b', textDecoration: 'none', fontWeight: 600 }}>
            Ir al inicio
          </a>
        </div>
      </body>
    </html>
  );
}
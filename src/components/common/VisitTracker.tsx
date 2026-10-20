'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Avisa a /api/visit cada vez que se carga una página o se navega a otra.
 * Vive en el layout raíz (nunca se desmonta), por eso detecta también los
 * cambios de ruta del App Router, que no recargan el documento.
 *
 * Solo usa usePathname (no useSearchParams): así no exige <Suspense> ni
 * afecta el renderizado estático/ISR de las páginas. fetch con keepalive
 * para que el aviso salga aunque el usuario cierre la pestaña enseguida.
 */
export function VisitTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return; // evita doble envío (StrictMode)
    last.current = pathname;
    try {
      fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* el registro de visitas nunca debe romper la página */
    }
  }, [pathname]);

  return null;
}

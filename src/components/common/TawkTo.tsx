'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useNearPageBottom } from '@/hooks/useNearPageBottom';

declare global {
  interface Window {
    Tawk_API?: {
      hideWidget?: () => void;
      showWidget?: () => void;
      [key: string]: unknown;
    };
  }
}

export function TawkTo() {
  const propertyId = process.env.NEXT_PUBLIC_TAWKTO_PROPERTY_ID;
  const widgetId   = process.env.NEXT_PUBLIC_TAWKTO_WIDGET_ID ?? 'default';
  const pathname = usePathname();
  // El panel de admin (/admin/*) tiene tablas con acciones (editar/borrar)
  // pegadas al borde derecho, y este widget se inyecta con un z-index muy
  // alto en esa misma esquina — tapaba filas enteras en mobile.
  const isAdmin = pathname?.startsWith('/admin') ?? false;
  // Si se entra directo a /admin (recarga, bookmark), ni siquiera se
  // inyecta el script — así se evita cualquier parpadeo del widget antes
  // de que el hideWidget() de abajo llegue a aplicarse. Si la navegación
  // a /admin es interna (SPA, viniendo de otra página), el script ya
  // estaba cargado de antes y el efecto de más abajo lo oculta igual.
  // ✅ PERF: PageSpeed marcaba "Minimiza el trabajo del hilo principal"
  // (2,1 s). Tawk.to es un widget de chat de terceros pesado — inyecta un
  // iframe y hace bastante trabajo de DOM apenas carga su script — y
  // antes se inyectaba apenas montaba este componente, compitiendo con el
  // resto del trabajo de hidratación justo en la ventana que mide
  // Lighthouse. Se demora la inyección hasta que el navegador está
  // inactivo (requestIdleCallback; Safari no lo soporta, de ahí el
  // fallback a setTimeout). Para una persona real esto es cuestión de
  // milisegundos — el chat sigue apareciendo enseguida — pero deja de
  // sumar al conteo de "trabajo del hilo principal" del reporte.
  useEffect(() => {
    if (!propertyId || isAdmin) return;

    let script: HTMLScriptElement | null = null;
    const inject = () => {
      script = document.createElement('script');
      script.async = true;
      script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');
      document.head.appendChild(script);
    };

    type IdleCb = (cb: () => void, opts?: { timeout: number }) => number;
    const w = window as unknown as { requestIdleCallback?: IdleCb; cancelIdleCallback?: (h: number) => void };
    const ric = w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1) as unknown as number);
    const cic = w.cancelIdleCallback ?? ((h: number) => window.clearTimeout(h));
    const handle = ric(inject, { timeout: 4000 });

    return () => {
      cic(handle);
      if (script) document.head.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, widgetId]);

  // Igual que el botón de WhatsApp: se oculta cerca del footer para no
  // tapar sus enlaces en mobile, y reaparece al alejarse. El tamaño y la
  // posición del widget los maneja tawk.to del lado de ellos, pero mostrar
  // y ocultar sí está expuesto vía su JS API (Tawk_API.hideWidget /
  // showWidget), disponible recién una vez que su script terminó de cargar
  // — por eso se chequea que sea función antes de llamarla.
  const nearBottom = useNearPageBottom();
  useEffect(() => {
    if (!propertyId) return;
    const api = window.Tawk_API;
    if (nearBottom || isAdmin) {
      api?.hideWidget?.();
    } else {
      api?.showWidget?.();
    }
  }, [nearBottom, isAdmin, propertyId]);

  return null;
}
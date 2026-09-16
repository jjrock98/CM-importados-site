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
  useEffect(() => {
    if (!propertyId || isAdmin) return;
    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    document.head.appendChild(s1);
    return () => { document.head.removeChild(s1); };
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
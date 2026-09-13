'use client';
import { useEffect } from 'react';
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

  useEffect(() => {
    if (!propertyId) return;
    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    document.head.appendChild(s1);
    return () => { document.head.removeChild(s1); };
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
    if (nearBottom) {
      api?.hideWidget?.();
    } else {
      api?.showWidget?.();
    }
  }, [nearBottom, propertyId]);

  return null;
}


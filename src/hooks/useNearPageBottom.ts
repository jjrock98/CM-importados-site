'use client';
import { useEffect, useState } from 'react';

/**
 * Devuelve `true` cuando el usuario está a `thresholdPx` o menos del final
 * del documento (típicamente el footer). Se usa para ocultar botones
 * flotantes (WhatsApp, tawk.to) justo antes de que tapen el contenido del
 * footer, y volver a mostrarlos al alejarse del final.
 *
 * Recalcula también en `resize`, porque la altura total del documento
 * cambia con el viewport (texto que se reflow-ea a más líneas en mobile).
 */
export function useNearPageBottom(thresholdPx = 260) {
  const [nearBottom, setNearBottom] = useState(false);

  useEffect(() => {
    const check = () => {
      const scrollBottom = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      setNearBottom(pageHeight - scrollBottom < thresholdPx);
    };

    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [thresholdPx]);

  return nearBottom;
}
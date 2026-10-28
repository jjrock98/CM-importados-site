'use client';
import { useEffect, useState } from 'react';

/**
 * Devuelve true mientras la persona está haciendo scroll en un celular
 * (pantallas de hasta 767px) y vuelve a false cuando se detiene (idleMs).
 * Sirve para que los botones flotantes (WhatsApp, chat, "volver arriba")
 * se corran mientras se lee el listado y reaparezcan al frenar, en vez de
 * quedar siempre encima de las tarjetas. En pantallas grandes siempre
 * devuelve false (los botones no se esconden).
 */
export function useHideWhileScrolling(idleMs = 900): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    let timer: number | undefined;

    const onScroll = () => {
      if (!mq.matches) return;
      setHidden(true); // React ignora el set si el valor ya es true
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHidden(false), idleMs);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, [idleMs]);

  return hidden;
}
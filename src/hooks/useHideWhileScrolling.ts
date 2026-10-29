'use client';
import { useEffect, useState } from 'react';

/**
 * Devuelve true mientras la persona está haciendo scroll en un celular
 * (pantallas de hasta 767px) y vuelve a false cuando se detiene (idleMs).
 * Sirve para que los botones flotantes (WhatsApp, chat, "volver arriba")
 * se corran mientras se lee el listado y reaparezcan al frenar, en vez de
 * quedar siempre encima de las tarjetas. En pantallas grandes siempre
 * devuelve false (los botones no se esconden).
 *
 * delayMs: tiempo de scroll continuo antes de ocultar. Con 0 se oculta al primer
 * movimiento; con un valor mayor (ej. 350) un toque corto de scroll no hace
 * parpadear el elemento (útil para widgets de terceros como el chat).
 */
export function useHideWhileScrolling(idleMs = 900, delayMs = 0): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    let idleTimer: number | undefined;
    let startTimer: number | undefined;

    const onScroll = () => {
      if (!mq.matches) return;
      if (delayMs <= 0) {
        setHidden(true); // React ignora el set si el valor ya es true
      } else if (startTimer === undefined) {
        startTimer = window.setTimeout(() => setHidden(true), delayMs);
      }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        window.clearTimeout(startTimer);
        startTimer = undefined;
        setHidden(false);
      }, idleMs);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(idleTimer);
      window.clearTimeout(startTimer);
    };
  }, [idleMs, delayMs]);

  return hidden;
}
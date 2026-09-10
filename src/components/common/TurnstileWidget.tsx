'use client';

import { useEffect, useId, useRef } from 'react';

// Tipado mínimo del script global que carga Cloudflare — no hay paquete
// oficial de tipos para esto, así que se declara lo que se usa.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// El script se comparte entre todos los widgets que haya en la página (por
// ejemplo, varios ProductCard con formulario propio) — se carga una sola vez.
let scriptPromise: Promise<void> | null = null;
function loadScriptOnce(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Turnstile'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileWidgetProps {
  /** Se llama con el token cada vez que el usuario pasa el desafío (o pasa el check invisible) */
  onVerify: (token: string) => void;
  /** Se llama si el token vence antes de enviar el formulario (Turnstile expira a los ~5 min) */
  onExpire?: () => void;
  className?: string;
}

export function TurnstileWidget({ onVerify, onExpire, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const domId = useId().replace(/:/g, '');
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      // No tirar error acá: dev local sin la key configurada no debería
      // romper el formulario, pero sí queda logueado para no olvidarse.
      console.warn('NEXT_PUBLIC_TURNSTILE_SITE_KEY no configurada — el captcha no se muestra');
      return;
    }

    let cancelled = false;

    loadScriptOnce()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token) => onVerify(token),
          'expired-callback': () => onExpire?.(),
        });
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;

  return <div id={domId} ref={containerRef} className={className} />;
}
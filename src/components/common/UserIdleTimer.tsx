'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Clock } from 'lucide-react';
import { hasSupabaseSessionCookie } from '@/lib/supabase/lazy';

/**
 * Cierre de sesión por inactividad para CLIENTES logueados, del lado del
 * navegador. Complementa el chequeo de proxy.ts (que solo corre cuando hay
 * una navegación de página): una pestaña olvidada abierta ya no queda
 * logueada indefinidamente.
 *
 *  - 2 h sin mouse/teclado/scroll/toque → se cierra la sesión.
 *  - 2 min antes aparece un aviso con cuenta regresiva y "Seguir conectado".
 *  - Mientras hay actividad, un latido a /auth/keepalive cada 10 min renueva
 *    la cookie `user_last_activity` del servidor (si no, el servidor creería
 *    que hubo inactividad y deslogueaba en la próxima navegación).
 *  - Varias pestañas comparten la última actividad vía localStorage.
 *  - No corre para visitantes sin sesión ni dentro de /admin (el panel tiene
 *    su propio AdminIdleTimer con límite de 30 min).
 *
 * El límite debe coincidir con USER_IDLE_LIMIT_SECONDS de proxy.ts.
 */
const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;
const WARNING_MS    = 2 * 60 * 1000;
const HEARTBEAT_MS  = 10 * 60 * 1000;
const STORAGE_KEY   = 'user-last-activity';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

function readShared(): number | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeShared(ts: number) {
  try { window.localStorage.setItem(STORAGE_KEY, String(ts)); } catch { /* modo privado */ }
}

export function UserIdleTimer() {
  const pathname = usePathname();
  // Se reevalúa en cada cambio de ruta: el login/logout navegan, y ahí
  // aparece o desaparece la cookie de sesión de Supabase.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(!pathname.startsWith('/admin') && hasSupabaseSessionCookie());
  }, [pathname]);

  const lastActivity  = useRef(Date.now());
  const lastWrite     = useRef(0);
  const lastHeartbeat = useRef(Date.now());
  const expiring      = useRef(false);
  const warningShown  = useRef(false);
  const pathRef       = useRef(pathname);
  pathRef.current = pathname;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const expire = useCallback(() => {
    if (expiring.current) return;
    expiring.current = true;
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/auth/user-idle-logout?next=${encodeURIComponent(next)}`);
  }, []);

  const heartbeat = useCallback(async () => {
    lastHeartbeat.current = Date.now();
    try {
      const res = await fetch('/auth/keepalive', {
        cache: 'no-store',
        redirect: 'manual',
        credentials: 'same-origin',
      });
      if (res.status === 401 || res.type === 'opaqueredirect') expire();
    } catch {
      /* sin red: se reintenta en el próximo latido */
    }
  }, [expire]);

  const markActive = useCallback((force = false) => {
    // Con el aviso visible, solo el botón renueva (un mouse que se mueve
    // por casualidad no debe esconderlo).
    if (warningShown.current && !force) return;
    const now = Date.now();
    lastActivity.current = now;
    if (force || now - lastWrite.current > 5_000) {
      lastWrite.current = now;
      writeShared(now);
    }
  }, []);

  const stayConnected = useCallback(() => {
    markActive(true);
    warningShown.current = false;
    setSecondsLeft(null);
    void heartbeat();
  }, [markActive, heartbeat]);

  useEffect(() => {
    if (!enabled) {
      warningShown.current = false;
      setSecondsLeft(null);
      return;
    }

    const onActivity = () => markActive();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const ts = parseInt(e.newValue, 10);
      if (Number.isFinite(ts) && ts > lastActivity.current) {
        lastActivity.current = ts;
        if (warningShown.current) {
          warningShown.current = false;
          setSecondsLeft(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    const shared = readShared();
    if (shared && shared > lastActivity.current && shared <= Date.now()) lastActivity.current = shared;
    markActive(true);
    lastHeartbeat.current = Date.now();

    // Se compara contra timestamps (no se cuentan ticks) para que funcione
    // aunque el navegador frene los timers de pestañas en segundo plano.
    const tick = () => {
      if (expiring.current) return;
      const now = Date.now();
      const idleFor = now - lastActivity.current;

      if (idleFor >= IDLE_LIMIT_MS) { expire(); return; }

      if (idleFor >= IDLE_LIMIT_MS - WARNING_MS) {
        warningShown.current = true;
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idleFor) / 1000)));
      } else if (now - lastHeartbeat.current >= HEARTBEAT_MS) {
        void heartbeat();
      }
    };
    const interval = window.setInterval(tick, 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [enabled, markActive, heartbeat, expire]);

  if (!enabled || secondsLeft === null) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="user-idle-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="card border border-border shadow-2xl p-6 max-w-sm w-full text-center">
        <Clock size={28} className="mx-auto mb-3 text-brand-500" />
        <h2 id="user-idle-title" className="text-base font-semibold mb-1">
          ¿Seguís ahí?
        </h2>
        <p className="text-sm text-muted mb-4">
          Por seguridad, vamos a cerrar tu sesión por inactividad en{' '}
          <span className="font-semibold tabular-nums">{mm}:{ss}</span>.
        </p>
        <div className="flex gap-2">
          <button onClick={stayConnected} className="btn-primary flex-1 py-2 text-sm" autoFocus>
            Seguir conectado
          </button>
          <button onClick={expire} className="btn-secondary flex-1 py-2 text-sm">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
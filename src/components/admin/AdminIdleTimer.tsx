'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

/**
 * Cierre de sesión automático del panel admin por inactividad, del lado
 * del navegador. Complementa el chequeo de proxy.ts (que solo corre cuando
 * hay una navegación de página):
 *
 *  - Una pestaña olvidada abierta ya no queda mostrando datos: a los
 *    30 min sin mouse/teclado/scroll/toque se cierra la sesión sola.
 *  - 2 min antes aparece un aviso con cuenta regresiva y el botón
 *    "Seguir conectado".
 *  - Mientras la persona SÍ está trabajando dentro de una misma pantalla
 *    (guardando productos por fetch, sin cambiar de página), manda un
 *    latido a /admin/keepalive cada 5 min para renovar la cookie
 *    `admin_last_activity` del servidor. Sin esto, el servidor creería
 *    que estuvo inactivo y la desloguearía en la próxima navegación.
 *  - Varias pestañas de admin comparten la última actividad vía
 *    localStorage: usar una mantiene viva a las otras.
 *
 * El límite debe coincidir con ADMIN_IDLE_LIMIT_SECONDS de proxy.ts.
 */
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARNING_MS    = 2 * 60 * 1000;
const HEARTBEAT_MS  = 5 * 60 * 1000;
const STORAGE_KEY   = 'admin-last-activity';
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

export function AdminIdleTimer() {
  const lastActivity  = useRef(Date.now());
  const lastWrite     = useRef(0);
  const lastHeartbeat = useRef(Date.now());
  const expiring      = useRef(false);
  const warningShown  = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const expire = useCallback(() => {
    if (expiring.current) return;
    expiring.current = true;
    window.location.assign('/auth/idle-logout');
  }, []);

  const heartbeat = useCallback(async () => {
    lastHeartbeat.current = Date.now();
    try {
      const res = await fetch('/admin/keepalive', {
        cache: 'no-store',
        redirect: 'manual',
        credentials: 'same-origin',
      });
      // El proxy responde con redirect cuando la sesión ya no es válida.
      if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) expire();
    } catch {
      /* sin red: se reintenta en el próximo latido */
    }
  }, [expire]);

  const markActive = useCallback((force = false) => {
    // Mientras se muestra el aviso, solo el botón "Seguir conectado" renueva
    // (un mouse que se mueve por casualidad no debe esconderlo).
    if (warningShown.current && !force) return;
    const now = Date.now();
    lastActivity.current = now;
    // Throttle de la escritura compartida: mousemove dispara muchísimo.
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
    const onActivity = () => markActive();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Actividad en otra pestaña del admin.
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

    // Al montar: si otra pestaña tuvo actividad más reciente, usarla.
    const shared = readShared();
    if (shared && shared > lastActivity.current && shared <= Date.now()) lastActivity.current = shared;
    markActive(true);
    // Montar = navegación de página: el proxy ya renovó la cookie del servidor.
    lastHeartbeat.current = Date.now();

    // Se compara contra timestamps (no se cuentan ticks) para que funcione
    // bien aunque el navegador frene los timers de pestañas en segundo plano.
    const tick = () => {
      if (expiring.current) return;
      const now = Date.now();
      const idleFor = now - lastActivity.current;

      if (idleFor >= IDLE_LIMIT_MS) { expire(); return; }

      if (idleFor >= IDLE_LIMIT_MS - WARNING_MS) {
        warningShown.current = true;
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idleFor) / 1000)));
      } else if (now - lastHeartbeat.current >= HEARTBEAT_MS) {
        // Hay actividad reciente dentro de la misma pantalla: renovar el servidor.
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
  }, [markActive, heartbeat, expire]);

  if (secondsLeft === null) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="card border border-border shadow-2xl p-6 max-w-sm w-full text-center">
        <Clock size={28} className="mx-auto mb-3 text-brand-500" />
        <h2 id="idle-title" className="text-base font-semibold mb-1">
          Tu sesión está por expirar
        </h2>
        <p className="text-sm text-muted mb-4">
          Por seguridad, se cerrará por inactividad en{' '}
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
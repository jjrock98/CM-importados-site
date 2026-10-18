'use client';
import { useState, useEffect, useCallback } from 'react';
import { isPushOriginAllowed } from '@/lib/pushOrigin';

const PUSH_STORAGE_KEY = 'admin-push-subscribed';

const MSG_UNSUPPORTED =
  'Este navegador no permite notificaciones. Si abriste el panel desde un link de Telegram u otra app, ' +
  'abrilo directamente en Chrome (menú ⋮ → "Abrir en Chrome") y probá de nuevo.';

const MSG_DENIED =
  'Las notificaciones están bloqueadas para este sitio. En Chrome tocá el candado junto a la dirección → ' +
  'Permisos → Notificaciones → Permitir, y volvé a tocar el botón.';

/**
 * Hook para el panel admin: gestiona el registro del Service Worker
 * y la suscripción a Web Push notifications.
 *
 * Uso: <AdminNotifications /> llama este hook y muestra un botón
 * "Activar notificaciones" cuando el admin aún no se suscribió.
 *
 * Solo permite suscribirse desde el dominio real del sitio (ver
 * lib/pushOrigin.ts). Desde cualquier otro origen (localhost, dominio
 * de Vercel, app instalada de otro dominio) el botón no aparece y, si ese
 * origen tenía una suscripción vieja, se da de baja sola — así no se
 * acumulan suscripciones duplicadas y cada aviso llega UNA vez.
 */
export function useAdminPush() {
  const [isSubscribed,   setIsSubscribed]   = useState(false);
  const [isSupported,    setIsSupported]    = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;

    const allowed = isPushOriginAllowed(
      window.location.origin,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NODE_ENV === 'production',
      process.env.NEXT_PUBLIC_ENABLE_DEV_PUSH === '1',
    );

    if (!allowed) {
      // isSupported queda en false (valor inicial): el botón no se muestra.
      if (supported) void removeStaleSubscriptions();
      return;
    }

    // El botón se muestra siempre en el dominio real. Si el navegador no
    // soporta push (p. ej. una pestaña abierta desde un link de Telegram),
    // subscribe() explica el motivo en pantalla en vez de esconder el botón.
    setIsSupported(true);
    if (!supported) return;

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      setSwRegistration(reg);
      // Verificar si ya hay suscripción activa
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    }).catch(console.error);
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError(MSG_UNSUPPORTED);
      return;
    }
    if (!swRegistration) {
      setError('El servicio de notificaciones todavía se está cargando. Probá de nuevo en unos segundos.');
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setError(MSG_DENIED);
      return;
    }

    setIsLoading(true);
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY no configurada');
        setError('Faltan las claves de notificaciones del sitio (NEXT_PUBLIC_VAPID_PUBLIC_KEY).');
        return;
      }

      const sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as ArrayBuffer,
      });

      // Guardar en la base de datos (con el origen, para poder detectar duplicados)
      const res = await fetch('/api/admin/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), origin: window.location.origin }),
      });
      if (!res.ok) {
        // El servidor rechazó la suscripción: se deshace en el navegador
        // para no dejar una suscripción huérfana.
        await sub.unsubscribe().catch(() => {});
        const text = await res.text();
        console.warn('[Push] El servidor rechazó la suscripción:', text);
        let detail = '';
        try { detail = JSON.parse(text).error ?? ''; } catch { /* no era JSON */ }
        setError(`El servidor no guardó la suscripción${detail ? `: ${detail}` : ''}.`);
        return;
      }

      setIsSubscribed(true);
      localStorage.setItem(PUSH_STORAGE_KEY, '1');
    } catch (err) {
      console.error('[Push] Error al suscribirse:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError(MSG_DENIED);
      } else {
        setError(`No se pudo activar: ${err instanceof Error ? err.message : 'error desconocido'}.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [swRegistration]);

  const unsubscribe = useCallback(async () => {
    if (!swRegistration) return;
    setIsLoading(true);
    try {
      const sub = await swRegistration.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/admin/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      localStorage.removeItem(PUSH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [swRegistration]);

  const clearError = useCallback(() => setError(null), []);

  return { isSubscribed, isSupported, isLoading, error, clearError, subscribe, unsubscribe };
}

/**
 * Da de baja cualquier suscripción push que este origen (no permitido)
 * tenga registrada: la borra de la base (si hay sesión) y del navegador.
 */
async function removeStaleSubscriptions() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) continue;
      await fetch('/api/admin/push-subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    localStorage.removeItem(PUSH_STORAGE_KEY);
  } catch (err) {
    console.warn('[Push] No se pudo limpiar la suscripción de este origen:', err);
  }
}

// Convierte la clave VAPID de base64 a Uint8Array (requerido por la API del navegador)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
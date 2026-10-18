'use client';
import { useState, useEffect, useCallback } from 'react';
import { isPushOriginAllowed } from '@/lib/pushOrigin';

const PUSH_STORAGE_KEY = 'admin-push-subscribed';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!supported) return;

    const allowed = isPushOriginAllowed(
      window.location.origin,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NODE_ENV === 'production',
      process.env.NEXT_PUBLIC_ENABLE_DEV_PUSH === '1',
    );

    if (!allowed) {
      // isSupported queda en false (valor inicial): el botón no se muestra.
      void removeStaleSubscriptions();
      return;
    }

    setIsSupported(true);
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      setSwRegistration(reg);
      // Verificar si ya hay suscripción activa
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    }).catch(console.error);
  }, []);

  const subscribe = useCallback(async () => {
    if (!swRegistration) return;
    setIsLoading(true);
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY no configurada');
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
        console.warn('[Push] El servidor rechazó la suscripción:', await res.text());
        return;
      }

      setIsSubscribed(true);
      localStorage.setItem(PUSH_STORAGE_KEY, '1');
    } catch (err) {
      console.error('[Push] Error al suscribirse:', err);
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

  return { isSubscribed, isSupported, isLoading, subscribe, unsubscribe };
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
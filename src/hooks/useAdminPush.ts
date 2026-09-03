'use client';
import { useState, useEffect, useCallback } from 'react';

const PUSH_STORAGE_KEY = 'admin-push-subscribed';

/**
 * Hook para el panel admin: gestiona el registro del Service Worker
 * y la suscripción a Web Push notifications.
 *
 * Uso: <AdminNotifications /> llama este hook y muestra un botón
 * "Activar notificaciones" cuando el admin aún no se suscribió.
 */
export function useAdminPush() {
  const [isSubscribed,   setIsSubscribed]   = useState(false);
  const [isSupported,    setIsSupported]    = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
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

      // Guardar en la base de datos
      await fetch('/api/admin/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });

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

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';

const METODO_PAGO_LABELS: Record<string, string> = {
  mercadopago:      'Mercado Pago',
  transferencia:    'Transferencia',
  cuenta_corriente: 'Cuenta corriente',
  efectivo:         'Efectivo',
};


const PUSH_STORAGE_KEY = 'admin-push-subscribed';

function isMobileDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function pushAlreadyActive(): boolean {
  try { return localStorage.getItem(PUSH_STORAGE_KEY) === '1'; } catch { return false; }
}

/**
 * Muestra un aviso del navegador. En Chrome para Android (y en general en
 * móviles) `new Notification()` lanza "Illegal constructor": hay que
 * mostrarlo a través del Service Worker. Nunca debe romper el panel.
 */
async function showBrowserNotification(title: string, body: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const icon = '/icons/icon-192.png';

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, { body, icon, data: { url: '/admin/pedidos' } });
        return;
      }
    }
    new Notification(title, { body, icon });
  } catch (err) {
    console.warn('[Notificaciones] No se pudo mostrar el aviso del navegador:', err);
  }
}

export interface RealtimeNotification {
  id:      string;
  type:    'new_order' | 'comprobante_uploaded' | 'order_updated';
  title:   string;
  message: string;
  orderId: string;
  read:    boolean;
  at:      Date;
}

export function useRealtimeOrders(onOrdersChange?: (orders: Order[]) => void) {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  // Keep the latest callback in a ref so the subscription effect below
  // doesn't need `onOrdersChange` in its deps (its identity changes every
  // render in the parent, which was causing the effect to re-run and try
  // to `.on()` a channel that was already `.subscribe()`d).
  const onOrdersChangeRef = useRef(onOrdersChange);
  useEffect(() => {
    onOrdersChangeRef.current = onOrdersChange;
  }, [onOrdersChange]);

  const addNotification = useCallback((n: Omit<RealtimeNotification, 'id' | 'read' | 'at'>) => {
    const notif: RealtimeNotification = {
      ...n,
      id:   crypto.randomUUID(),
      read: false,
      at:   new Date(),
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 50)); // keep last 50
    setUnreadCount((c) => c + 1);

    // Aviso del navegador (si hay permiso).
    // Si este dispositivo ya tiene Web Push activo, el aviso lo muestra el
    // Service Worker: mostrarlo también acá lo duplicaba.
    if (!pushAlreadyActive()) {
      void showBrowserNotification(n.title, n.message);
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  useEffect(() => {
    // Pedir permiso de notificaciones SOLO en desktop. En celular el permiso
    // se pide al tocar el botón de activar (hace falta un gesto del usuario:
    // pedirlo solo al cargar la página lo ignora o hasta lo bloquea Chrome).
    try {
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default' &&
        !isMobileDevice()
      ) {
        Promise.resolve(Notification.requestPermission()).catch(() => {});
      }
    } catch { /* navegador sin soporte */ }

    // Defensive: if a channel with this topic is already registered
    // (e.g. leftover from a Fast Refresh / StrictMode double-invoke),
    // remove it first so `.channel()` doesn't hand back an
    // already-`.subscribe()`d instance.
    const existing = supabase.getChannels().find((c) => c.topic === 'realtime:admin-orders-realtime');
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel('admin-orders-realtime')

      // ── New order ───────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const order = payload.new as Order;
          addNotification({
            type:    'new_order',
            title:   '🛒 Nuevo pedido',
            message: `${order.nombre} · ${METODO_PAGO_LABELS[order.metodo_pago] ?? order.metodo_pago}`,
            orderId: order.id,
          });
          // Notify parent to refresh orders list
          if (onOrdersChangeRef.current) {
            supabase
              .from('orders')
              .select('*, order_items(*)')
              .order('created_at', { ascending: false })
              .limit(100)
              .then(({ data }) => { if (data) onOrdersChangeRef.current!(data as Order[]); });
          }
        }
      )

      // ── Order updated ────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder  = payload.new as Order;
          const oldOrder  = payload.old as Partial<Order>;

          // Comprobante recién subido
          if (!oldOrder.comprobante_url && newOrder.comprobante_url) {
            addNotification({
              type:    'comprobante_uploaded',
              title:   '📎 Comprobante recibido',
              message: `${newOrder.nombre} subió el comprobante. Revisalo en el panel.`,
              orderId: newOrder.id,
            });
          }

          // Estado cambió
          if (oldOrder.estado && newOrder.estado !== oldOrder.estado) {
            addNotification({
              type:    'order_updated',
              title:   '🔄 Pedido actualizado',
              message: `Pedido #${newOrder.id.slice(0,8).toUpperCase()} → ${newOrder.estado}`,
              orderId: newOrder.id,
            });
          }

          // Notify parent
          if (onOrdersChangeRef.current) {
            supabase
              .from('orders')
              .select('*, order_items(*)')
              .order('created_at', { ascending: false })
              .limit(100)
              .then(({ data }) => { if (data) onOrdersChangeRef.current!(data as Order[]); });
          }
        }
      )

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Admin orders channel active');
        }
      });

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addNotification]);

  return { notifications, unreadCount, markAllRead, markRead };
}
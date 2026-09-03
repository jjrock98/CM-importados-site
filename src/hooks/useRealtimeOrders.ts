'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';

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

    // Browser notification (if permission granted)
    if (typeof window !== 'undefined' && Notification.permission === 'granted') {
      new Notification(n.title, { body: n.message, icon: '/icons/icon-192.png' });
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
    // Request browser notification permission
    if (typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

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
            message: `${order.nombre} · ${
              order.metodo_pago === 'mercadopago' ? 'Mercado Pago' : 'Transferencia'
            }`,
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
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, ShoppingBag, FileCheck, RefreshCw, CheckCheck, X, Smartphone, SmartphoneNfc } from 'lucide-react';
import { useRealtimeOrders, type RealtimeNotification } from '@/hooks/useRealtimeOrders';
import { useAdminPush } from '@/hooks/useAdminPush';
import { cn } from '@/utils';

const NOTIF_ICONS: Record<RealtimeNotification['type'], React.ReactNode> = {
  new_order:            <ShoppingBag size={15} className="text-brand-500" />,
  comprobante_uploaded: <FileCheck   size={15} className="text-green-500" />,
  order_updated:        <RefreshCw   size={15} className="text-blue-500"  />,
};

function formatRelative(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export function AdminNotifications() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, markRead } = useRealtimeOrders();
  const { isSubscribed, isSupported, isLoading, subscribe, unsubscribe } = useAdminPush();

  return (
    <div className="relative flex items-center gap-2">

      {/* ✅ MÓDULO 5 — Botón de activación de push notifications al dispositivo */}
      {isSupported && (
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          title={isSubscribed
            ? 'Notificaciones push activas — click para desactivar'
            : 'Activar notificaciones push en este dispositivo'}
          className={cn(
            'btn-ghost p-2 transition-colors',
            isSubscribed ? 'text-green-500 hover:text-red-400' : 'text-muted hover:text-brand-600'
          )}
          aria-label={isSubscribed ? 'Desactivar notificaciones push' : 'Activar notificaciones push'}
        >
          {isLoading
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            : isSubscribed
              ? <SmartphoneNfc size={18} />
              : <Smartphone    size={18} />}
        </button>
      )}

      {/* Campana de notificaciones in-app (Supabase Realtime) */}
      <button
        onClick={() => { setOpen(!open); if (!open && unreadCount > 0) markAllRead(); }}
        className="relative btn-ghost p-2 text-muted hover:text-foreground"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="font-semibold text-sm">Notificaciones</h3>
                {isSupported && (
                  <p className={cn('text-[10px] mt-0.5', isSubscribed ? 'text-green-500' : 'text-muted')}>
                    {isSubscribed ? '📱 Push activo en este dispositivo' : '📵 Push no activado'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={markAllRead} className="text-xs text-muted hover:text-brand-600 flex items-center gap-1">
                    <CheckCheck size={12} /> Leer todo
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted">
                  <Bell size={32} className="opacity-20" />
                  <p className="text-xs">Sin notificaciones</p>
                  {isSupported && !isSubscribed && (
                    <button
                      onClick={subscribe}
                      className="btn-primary text-xs px-3 py-1.5 mt-2"
                    >
                      Activar notificaciones push
                    </button>
                  )}
                </div>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href="/admin/pedidos"
                    onClick={() => { markRead(n.id); setOpen(false); }}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-2 border-b border-border last:border-0',
                      !n.read && 'bg-brand-50/50 dark:bg-brand-950/10'
                    )}
                  >
                    <span className="mt-0.5 shrink-0">{NOTIF_ICONS[n.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{n.title}</p>
                      <p className="text-muted text-xs truncate">{n.message}</p>
                      <p className="text-muted text-[10px] mt-1">{formatRelative(n.at)}</p>
                    </div>
                    {!n.read && <div className="h-2 w-2 shrink-0 rounded-full bg-brand-500 mt-1" />}
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

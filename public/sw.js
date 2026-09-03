// Service Worker para Web Push notifications (Panel Admin)
// Recibe notificaciones push cuando el admin NO tiene el sitio abierto.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'Nueva notificación', body: event.data.text() }; }

  const options = {
    body:    payload.body   ?? 'Revisá el panel de administración.',
    icon:    payload.icon   ?? '/icons/icon-192x192.png',
    badge:   payload.badge  ?? '/icons/icon-72x72.png',
    tag:     payload.tag    ?? 'admin-notification',
    data:    payload.data   ?? { url: '/admin/pedidos' },
    actions: [
      { action: 'open',    title: 'Ver pedidos' },
      { action: 'dismiss', title: 'Descartar'   },
    ],
    requireInteraction: true, // la notificación no se cierra sola
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Nueva venta', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url ?? '/admin/pedidos';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes('/admin'));
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});

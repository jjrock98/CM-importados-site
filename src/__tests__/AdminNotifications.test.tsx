import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminNotifications } from '@/components/admin/AdminNotifications';

// El hook de Realtime abre un canal de Supabase: no es lo que se prueba acá.
jest.mock('@/hooks/useRealtimeOrders', () => ({
  useRealtimeOrders: () => ({
    notifications: [], unreadCount: 0, markAllRead: jest.fn(), markRead: jest.fn(),
  }),
}));

// En jest NODE_ENV = 'test' (no producción): se habilita el push para poder probar.
beforeAll(() => { process.env.NEXT_PUBLIC_ENABLE_DEV_PUSH = '1'; });

describe('AdminNotifications — botón de push en celular', () => {
  afterEach(() => {
    // @ts-expect-error limpieza de los mocks del navegador
    delete navigator.serviceWorker;
    // @ts-expect-error limpieza de los mocks del navegador
    delete window.PushManager;
  });

  it('en un navegador SIN soporte de push muestra el botón y explica el motivo al tocarlo', async () => {
    // Simula una pestaña abierta desde otra app (sin serviceWorker ni PushManager)
    render(<AdminNotifications />);

    const boton = await screen.findByRole('button', { name: /activar notificaciones push/i });
    expect(screen.getByText('Activar avisos')).toBeTruthy();

    fireEvent.click(boton);

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toMatch(/Abrir en Chrome/);
  });

  it('con soporte de push, el botón existe y pide el permiso al tocarlo', async () => {
    const subscribe = jest.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const reg = { pushManager: { getSubscription: jest.fn().mockResolvedValue(null), subscribe } };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: jest.fn().mockResolvedValue(reg), getRegistrations: jest.fn().mockResolvedValue([]) },
    });
    // @ts-expect-error mock de la API del navegador
    window.PushManager = function PushManager() {};
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

    render(<AdminNotifications />);
    const boton = await screen.findByRole('button', { name: /activar notificaciones push/i });
    // espera a que el Service Worker quede registrado
    await waitFor(() => expect(navigator.serviceWorker.register).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(boton);
    await waitFor(() => expect(subscribe).toHaveBeenCalled());

    // Si el usuario rechaza el permiso, ve el motivo (antes no pasaba nada visible)
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toMatch(/bloqueadas/i);
  });
});
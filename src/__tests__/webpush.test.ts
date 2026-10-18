import webpush from 'web-push';
import { sendAdminPushNotification } from '@/lib/webpush';

jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn().mockResolvedValue({}) },
}));
jest.mock('@/lib/telegram', () => ({ sendAdminTelegramNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/env', () => ({ env: { APP_URL: 'https://mc-importados.shop' } }));

let rows: Array<{ endpoint: string; p256dh: string; auth: string; origin: string | null }> = [];
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: rows, error: null }),
      delete: () => ({ in: () => Promise.resolve({}) }),
    }),
  }),
}));

const send = webpush.sendNotification as jest.Mock;

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY  = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
});
beforeEach(() => { send.mockClear(); });

describe('sendAdminPushNotification', () => {
  it('envía con prioridad alta y TTL de 24 h (para que llegue con el celular en reposo)', async () => {
    rows = [{ endpoint: 'https://fcm/1', p256dh: 'k', auth: 'a', origin: 'https://mc-importados.shop' }];
    await sendAdminPushNotification({ title: 'Nuevo pedido', body: 'x' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][2]).toEqual({ urgency: 'high', TTL: 86400 });
  });

  it('no envía a suscripciones de otro origen (localhost, vercel.app) y sí a las de origen desconocido', async () => {
    rows = [
      { endpoint: 'https://fcm/real',  p256dh: 'k', auth: 'a', origin: 'https://www.mc-importados.shop' },
      { endpoint: 'https://fcm/local', p256dh: 'k', auth: 'a', origin: 'http://localhost:3000' },
      { endpoint: 'https://fcm/vieja', p256dh: 'k', auth: 'a', origin: null },
    ];
    await sendAdminPushNotification({ title: 'Nuevo pedido', body: 'x' });

    const enviados = send.mock.calls.map((c) => c[0].endpoint).sort();
    expect(enviados).toEqual(['https://fcm/real', 'https://fcm/vieja']);
  });
});
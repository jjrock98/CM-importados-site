/**
 * @jest-environment node
 *
 * Integración real con el SDK de Sentry (sin mocks y sin red): se reemplaza el
 * transporte para capturar lo que SE ENVIARÍA y comprobar que no se filtran datos.
 */
import * as Sentry from '@sentry/nextjs';
import { sentryBaseOptions } from '@/lib/sentryShared';

type Envelope = [unknown, [{ type: string }, Record<string, unknown>][]];

describe('Sentry (integración, sin red)', () => {
  const enviados: Envelope[] = [];
  // Los "secretos" se arman en tiempo de ejecución: si estuvieran escritos acá,
  // Sentry los adjuntaría como líneas de contexto del código fuente de esta prueba.
  const SECRETO = ['SUPER', 'SECRETO'].join('-');
  const EMAIL = ['cliente', 'mail.com'].join('@');
  const IP = [1, 2, 3, 4].join('.');
  const BEARER = ['Bearer', 'zzz'].join(' ');

  const eventos = () =>
    enviados.flatMap((e) => e[1].filter((i) => i[0].type === 'event').map((i) => i[1]));

  beforeAll(() => {
    Sentry.init({
      dsn: 'https://publica@o123.ingest.sentry.io/456',
      enabled: true,
      ...sentryBaseOptions,
      transport: () => ({
        send: async (envelope: unknown) => { enviados.push(envelope as Envelope); return {}; },
        flush: async () => true,
      }),
    });
  });

  it('un error llega al transporte sin secretos, cookies ni datos personales', async () => {
    Sentry.withScope((scope) => {
      scope.setUser({ id: 'u1', email: EMAIL, ip_address: IP });
      scope.setSDKProcessingMetadata({
        normalizedRequest: {
          url: `https://tienda.com/api/revalidate?secret=${SECRETO}`,
          query_string: `secret=${SECRETO}`,
          headers: { cookie: 'sb=abc', authorization: BEARER },
          cookies: { sb: 'abc' },
        },
      });
      Sentry.captureException(new Error('falló algo'), { tags: { area: 'orders' }, extra: { orderId: '7' } });
    });
    await Sentry.flush(2000);

    const evs = eventos();
    expect(evs).toHaveLength(1);
    const ev = evs[0] as { request?: { url?: string; headers?: object; cookies?: unknown; query_string?: unknown }; user?: object; tags?: object };
    expect(ev.tags).toMatchObject({ area: 'orders' });
    expect(ev.request?.url).toBe('https://tienda.com/api/revalidate');
    expect(ev.request?.query_string).toBeUndefined();
    expect(ev.request?.cookies).toBeUndefined();
    expect(ev.request?.headers).toEqual({});
    expect(ev.user).toEqual({ id: 'u1' });

    const todo = JSON.stringify(enviados);
    for (const dato of [SECRETO, EMAIL, IP, BEARER]) expect(todo).not.toContain(dato);
  });

  it('los errores de ruido conocido no se envían como evento (solo un contador de descartes)', async () => {
    const antes = eventos().length;
    for (const msg of ['ResizeObserver loop limit exceeded', 'Failed to fetch', 'Load failed']) {
      Sentry.captureException(new Error(msg));
    }
    await Sentry.flush(1000);
    expect(eventos().length).toBe(antes);

    Sentry.captureException(new Error('error real de la tienda'));
    await Sentry.flush(1000);
    expect(eventos().length).toBe(antes + 1);
  });
});
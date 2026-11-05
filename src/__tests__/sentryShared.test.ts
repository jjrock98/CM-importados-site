/**
 * @jest-environment node
 */
import type { ErrorEvent } from '@sentry/nextjs';

const mockCapture = jest.fn();
jest.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => mockCapture(...a) }));

import { scrubEvent, scrubBreadcrumb, sentryBaseOptions } from '@/lib/sentryShared';
import { reportError } from '@/lib/monitoring';
import { storefrontCsp } from '@/lib/csp';

describe('scrubEvent (limpieza antes de enviar a Sentry)', () => {
  it('saca cookies, headers de autenticación y query string (?secret= de los crons)', () => {
    const e = scrubEvent({
      type: undefined,
      request: {
        url: 'https://tienda.com/api/revalidate?secret=SUPER-SECRETO&x=1',
        query_string: 'secret=SUPER-SECRETO&x=1',
        cookies: { sb: 'token' },
        headers: { Cookie: 'sb=token', Authorization: 'Bearer abc', 'User-Agent': 'jest' },
      },
    } as ErrorEvent);
    expect(e.request?.url).toBe('https://tienda.com/api/revalidate');
    expect(e.request?.query_string).toBeUndefined();
    expect(e.request?.cookies).toBeUndefined();
    expect(e.request?.headers).toEqual({ 'User-Agent': 'jest' });
    expect(JSON.stringify(e)).not.toContain('SUPER-SECRETO');
  });

  it('del usuario conserva solo el id (sin email ni IP)', () => {
    const e = scrubEvent({
      type: undefined,
      user: { id: 'u1', email: 'cliente@mail.com', ip_address: '1.2.3.4', username: 'x' },
    } as ErrorEvent);
    expect(e.user).toEqual({ id: 'u1' });
    expect(scrubEvent({ type: undefined, user: { email: 'a@b.com' } } as ErrorEvent).user).toBeUndefined();
  });
});

describe('scrubBreadcrumb', () => {
  it('descarta los avisos de consola', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'email: a@b.com' })).toBeNull();
  });
  it('quita el query string de las URLs', () => {
    const b = scrubBreadcrumb({ category: 'fetch', data: { url: '/api/seguimiento?email=a@b.com&id=5' } });
    expect(b?.data?.url).toBe('/api/seguimiento');
  });
});

describe('configuración base', () => {
  it('no envía datos personales por defecto y filtra scripts de terceros', () => {
    expect(sentryBaseOptions.sendDefaultPii).toBe(false);
    expect(sentryBaseOptions.denyUrls.some((r) => r.test('https://embed.tawk.to/x.js'))).toBe(true);
  });
});

describe('reportError', () => {
  beforeEach(() => mockCapture.mockReset());
  it('reenvía el error con la etiqueta del área', () => {
    const err = new Error('boom');
    reportError(err, 'orders', { orderId: '7' });
    expect(mockCapture).toHaveBeenCalledWith(err, { tags: { area: 'orders' }, extra: { orderId: '7' } });
  });
  it('NUNCA lanza, aunque Sentry falle (no puede romper una request)', () => {
    mockCapture.mockImplementation(() => { throw new Error('sentry caído'); });
    expect(() => reportError(new Error('x'), 'orders')).not.toThrow();
  });
});

describe('CSP', () => {
  it('permite enviar errores a Sentry (connect-src)', () => {
    const connect = storefrontCsp().split(';').find((d) => d.trim().startsWith('connect-src')) ?? '';
    expect(connect).toContain('https://*.ingest.sentry.io');
    expect(connect).toContain('https://*.ingest.us.sentry.io');
    expect(connect).toContain('https://*.ingest.de.sentry.io');
  });
});
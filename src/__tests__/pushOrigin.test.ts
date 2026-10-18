import { normalizeOrigin, isPushOriginAllowed } from '@/lib/pushOrigin';

describe('normalizeOrigin', () => {
  it('quita ruta y www', () => {
    expect(normalizeOrigin('https://www.mc-importados.shop/admin/pedidos')).toBe('https://mc-importados.shop');
  });
  it('conserva el puerto', () => {
    expect(normalizeOrigin('http://localhost:3000/x')).toBe('http://localhost:3000');
  });
  it('devuelve null con valores inválidos o vacíos', () => {
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin('no es una url')).toBeNull();
  });
});

describe('isPushOriginAllowed', () => {
  const APP = 'https://mc-importados.shop';

  it('permite el dominio real en producción (con o sin www)', () => {
    expect(isPushOriginAllowed('https://mc-importados.shop', APP, true, false)).toBe(true);
    expect(isPushOriginAllowed('https://www.mc-importados.shop', APP, true, false)).toBe(true);
  });
  it('bloquea otros dominios en producción (vercel.app, localhost)', () => {
    expect(isPushOriginAllowed('https://cm-importados.vercel.app', APP, true, false)).toBe(false);
    expect(isPushOriginAllowed('http://localhost:3000', APP, true, false)).toBe(false);
  });
  it('en desarrollo bloquea salvo que se active el opt-in', () => {
    expect(isPushOriginAllowed('http://localhost:3000', 'http://localhost:3000', false, false)).toBe(false);
    expect(isPushOriginAllowed('http://localhost:3000', 'http://localhost:3000', false, true)).toBe(true);
  });
  it('si APP_URL no está configurada no bloquea en producción', () => {
    expect(isPushOriginAllowed('https://cualquiera.com', undefined, true, false)).toBe(true);
  });
});
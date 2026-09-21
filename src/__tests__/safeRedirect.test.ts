import { safeRedirectPath } from '@/lib/safeRedirect';

describe('safeRedirectPath', () => {
  it('deja pasar rutas internas (con query y hash)', () => {
    expect(safeRedirectPath('/admin')).toBe('/admin');
    expect(safeRedirectPath('/productos?q=zueco&pagina=2')).toBe('/productos?q=zueco&pagina=2');
    expect(safeRedirectPath('/carrito#resumen')).toBe('/carrito#resumen');
  });

  it('usa el fallback si falta el valor', () => {
    expect(safeRedirectPath(null)).toBe('/');
    expect(safeRedirectPath(undefined, '/admin')).toBe('/admin');
    expect(safeRedirectPath('', '/admin')).toBe('/admin');
  });

  it('rechaza URLs absolutas y de protocolo relativo', () => {
    expect(safeRedirectPath('https://sitio-malo.com')).toBe('/');
    expect(safeRedirectPath('http://sitio-malo.com/x')).toBe('/');
    expect(safeRedirectPath('//sitio-malo.com')).toBe('/');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
    expect(safeRedirectPath('sitio-malo.com')).toBe('/');
  });

  it('rechaza variantes con barra invertida y caracteres de control', () => {
    expect(safeRedirectPath('/\\sitio-malo.com')).toBe('/');
    expect(safeRedirectPath('/\t/sitio-malo.com')).toBe('/');
    expect(safeRedirectPath('/\n/sitio-malo.com')).toBe('/');
  });
});
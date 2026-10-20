import { parseCspReports, normalizeBlocked, normalizePage, violationField } from '@/lib/cspReport';

describe('cspReport', () => {
  it('normaliza lo bloqueado: palabras clave tal cual, URLs solo con el origen', () => {
    expect(normalizeBlocked('inline')).toBe('inline');
    expect(normalizeBlocked('eval')).toBe('eval');
    expect(normalizeBlocked('https://embed.tawk.to/abc/def.js?token=SECRETO')).toBe('https://embed.tawk.to');
    expect(normalizeBlocked('data:image/png;base64,AAAA')).toBe('data');
    expect(normalizeBlocked('')).toBe('unknown');
    expect(normalizeBlocked('???')).toBe('unknown');
  });

  it('normaliza la página: sin dominio ni query y con ids colapsados', () => {
    expect(normalizePage('https://www.mc-importados.shop/admin/pedidos?x=1')).toBe('/admin/pedidos');
    expect(normalizePage('https://x.shop/admin/pedidos/72237228-6d08-4fc0-ac2d-4dfea1a22216'))
      .toBe('/admin/pedidos/:id');
  });

  it('lee el formato clásico (report-uri)', () => {
    const body = JSON.stringify({ 'csp-report': {
      'document-uri': 'https://x.shop/admin',
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'inline',
      'source-file': 'https://x.shop/admin?a=b',
      'line-number': 12,
    } });
    const [v] = parseCspReports(body);
    expect(v).toEqual({ directive: 'script-src-elem', blocked: 'inline', page: '/admin', source: 'https://x.shop/admin:12' });
    expect(violationField(v)).toBe('script-src-elem | inline | /admin');
  });

  it('lee el formato nuevo (Reporting API) y limita la cantidad', () => {
    const item = { type: 'csp-violation', body: { effectiveDirective: 'img-src', blockedURL: 'https://a.com/i.png', documentURL: 'https://x.shop/admin/productos' } };
    const body = JSON.stringify(Array.from({ length: 50 }, () => item));
    const out = parseCspReports(body);
    expect(out).toHaveLength(10);
    expect(out[0].directive).toBe('img-src');
  });

  it('ignora basura sin romperse', () => {
    expect(parseCspReports('no es json')).toEqual([]);
    expect(parseCspReports('{"otra":1}')).toEqual([]);
    expect(parseCspReports('[1,2,3]')).toEqual([]);
  });
});
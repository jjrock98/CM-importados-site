import { storefrontCsp, adminCsp } from '@/lib/csp';

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('CSP', () => {
  const store = storefrontCsp();
  const admin = adminCsp('NONCE123');

  it('ambas políticas bloquean plugins, <base> ajeno y embeber el sitio', () => {
    for (const csp of [store, admin]) {
      expect(directive(csp, 'object-src')).toBe("object-src 'none'");
      expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
      expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    }
  });

  it('el admin exige nonce + strict-dynamic y NO permite scripts inline', () => {
    const script = directive(admin, 'script-src');
    expect(script).toContain("'nonce-NONCE123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it('la tienda conserva sus scripts de terceros permitidos', () => {
    const script = directive(store, 'script-src');
    for (const host of ['https://sdk.mercadopago.com', 'https://embed.tawk.to', 'https://*.googletagmanager.com', 'https://www.clarity.ms']) {
      expect(script).toContain(host);
    }
  });

  it('admin y tienda solo difieren en script-src', () => {
    const sinScript = (csp: string) => csp.split('; ').filter((d) => !d.startsWith('script-src ')).join('; ');
    expect(sinScript(admin)).toBe(sinScript(store));
  });
});
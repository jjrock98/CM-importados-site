import { isIP } from 'node:net';

/**
 * IP real del visitante, para código de servidor (route handlers).
 *
 * El sitio corre en Vercel: su borde de red PISA los headers
 * `x-forwarded-for`, `x-real-ip` y `x-vercel-forwarded-for` con la IP real
 * del cliente, así que un visitante no puede falsificarlos mandando los
 * suyos. (Si algún día se pone otro proxy delante, p. ej. Cloudflare,
 * habría que priorizar `cf-connecting-ip`.)
 *
 * Devuelve null si no hay una IP válida (dev local sin proxy, header raro).
 * Usa la misma fuente que el rate limit (src/lib/rateLimit.ts → getIp).
 */
export function getClientIp(req: Request): string | null {
  const h = req.headers;
  const raw =
    h.get('x-vercel-forwarded-for') ??
    h.get('x-real-ip') ??
    h.get('x-forwarded-for')?.split(',')[0] ??
    null;
  if (!raw) return null;

  // "::ffff:1.2.3.4" (IPv4 mapeada en IPv6) → "1.2.3.4"
  const ip = raw.trim().replace(/^::ffff:/i, '');
  return isIP(ip) ? ip : null;
}

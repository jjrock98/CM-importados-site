import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count:     number;
  resetTime: number;
}

// In-memory store — works for single-instance deploys and Vercel Edge
// For multi-region, replace with Upstash Redis
const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

interface RateLimitConfig {
  /** Max requests per window */
  limit:        number;
  /** Window duration in seconds */
  windowSecs:   number;
  /** Key prefix for this route */
  prefix:       string;
}

/**
 * Returns NextResponse 429 if rate limit exceeded, null otherwise.
 *
 * Usage in API route:
 *   const limited = await rateLimit(req, { limit: 5, windowSecs: 60, prefix: 'contact' });
 *   if (limited) return limited;
 */
export function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): NextResponse | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous';

  const key     = `${config.prefix}:${ip}`;
  const now     = Date.now();
  const windowMs = config.windowSecs * 1000;

  const entry = store.get(key);

  if (!entry || entry.resetTime < now) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intentá de nuevo en unos momentos.' },
      {
        status: 429,
        headers: {
          'Retry-After':          String(retryAfter),
          'X-RateLimit-Limit':    String(config.limit),
          'X-RateLimit-Remaining':'0',
          'X-RateLimit-Reset':    String(Math.ceil(entry.resetTime / 1000)),
        },
      }
    );
  }

  return null;
}

// Pre-configured rate limiters for common routes
export const rateLimiters = {
  /** Contact form: 3 requests / 10 min */
  contact: (req: NextRequest) =>
    rateLimit(req, { limit: 3, windowSecs: 600, prefix: 'contact' }),

  /** Auth: 10 requests / 15 min */
  auth: (req: NextRequest) =>
    rateLimit(req, { limit: 10, windowSecs: 900, prefix: 'auth' }),

  /** Registro de cuenta: 5 requests / 60 min — crear una cuenta es algo
   *  mucho más raro que intentar loguearse, así que el límite es más chico */
  register: (req: NextRequest) =>
    rateLimit(req, { limit: 5, windowSecs: 3600, prefix: 'register' }),

  /** Orders: 10 requests / 5 min */
  orders: (req: NextRequest) =>
    rateLimit(req, { limit: 10, windowSecs: 300, prefix: 'orders' }),

  /** Checkout: 5 requests / 5 min */
  checkout: (req: NextRequest) =>
    rateLimit(req, { limit: 5, windowSecs: 300, prefix: 'checkout' }),

  /** Send notification: 60 requests / 5 min (llamadas internas server-to-server) */
  notifications: (req: NextRequest) =>
    rateLimit(req, { limit: 60, windowSecs: 300, prefix: 'notifications' }),

  /** Upload: 5 requests / 10 min */
  upload: (req: NextRequest) =>
    rateLimit(req, { limit: 5, windowSecs: 600, prefix: 'upload' }),

  /** Seguimiento de pedido (invitado): 8 requests / 10 min — evita
   *  probar combinaciones de ID+email por fuerza bruta */
  seguimiento: (req: NextRequest) =>
    rateLimit(req, { limit: 8, windowSecs: 600, prefix: 'seguimiento' }),
};
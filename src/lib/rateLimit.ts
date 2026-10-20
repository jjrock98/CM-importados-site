import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface RateLimitEntry {
  count:     number;
  resetTime: number;
}

// ── Almacén en memoria ────────────────────────────────────────────────
// Sirve para una sola instancia. En Vercel cada instancia serverless tiene
// su propia memoria, así que NO frena a un atacante repartido entre varias.
// Se usa como (1) límite global "best effort" en proxy.ts, (2) respaldo si
// Upstash no está configurado o falla.
const store = new Map<string, RateLimitEntry>();

// Limpieza cada 5 minutos para no acumular memoria
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

interface RateLimitConfig {
  /** Máximo de requests por ventana */
  limit:        number;
  /** Duración de la ventana en segundos */
  windowSecs:   number;
  /** Prefijo de la clave para esta ruta */
  prefix:       string;
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous'
  );
}

function tooManyRequests(limit: number, resetMs: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Intentá de nuevo en unos momentos.' },
    {
      status: 429,
      headers: {
        'Retry-After':          String(retryAfter),
        'X-RateLimit-Limit':    String(limit),
        'X-RateLimit-Remaining':'0',
        'X-RateLimit-Reset':    String(Math.ceil(resetMs / 1000)),
      },
    }
  );
}

/**
 * Límite EN MEMORIA (síncrono). Devuelve NextResponse 429 si se excedió, o null.
 * Lo usa proxy.ts (flood global) y es el respaldo de rateLimitDistributed.
 */
export function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): NextResponse | null {
  const key      = `${config.prefix}:${getIp(req)}`;
  const now      = Date.now();
  const windowMs = config.windowSecs * 1000;

  const entry = store.get(key);

  if (!entry || entry.resetTime < now) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) return tooManyRequests(config.limit, entry.resetTime);

  return null;
}

// ── Upstash Redis (límite compartido entre TODAS las instancias) ──────
// Requiere UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN. Si faltan, o si
// Upstash no responde, se usa el límite en memoria: nunca se tumba una ruta
// por culpa del rate limit.
let redis: Redis | null | undefined; // undefined = todavía no se intentó crear
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const limiters = new Map<string, Ratelimit>();
function getLimiter(r: Redis, config: RateLimitConfig): Ratelimit {
  const id = `${config.prefix}:${config.limit}:${config.windowSecs}`;
  let l = limiters.get(id);
  if (!l) {
    l = new Ratelimit({
      redis:     r,
      limiter:   Ratelimit.slidingWindow(config.limit, `${config.windowSecs} s`),
      prefix:    `rl:${config.prefix}`,
      analytics: false,
      timeout:   5000, // el corte real lo hace rateLimitDistributed (800 ms)
    });
    limiters.set(id, l);
  }
  return l;
}

// Si Upstash falla o tarda, se usa el límite en memoria durante este tiempo
// antes de volver a intentarlo (así no se demora cada request mientras está caído).
const UPSTASH_TIMEOUT_MS = 800;
const UPSTASH_RETRY_AFTER_MS = 30_000;
let upstashDownUntil = 0;

/**
 * Límite DISTRIBUIDO (asíncrono): hay que usar `await`.
 *
 *   const limited = await rateLimitDistributed(req, { limit: 5, windowSecs: 60, prefix: 'x' });
 *   if (limited) return limited;
 */
export async function rateLimitDistributed(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const r = getRedis();
  if (!r || Date.now() < upstashDownUntil) return rateLimit(req, config);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { success, limit, reset } = await Promise.race([
      getLimiter(r, config).limit(getIp(req)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), UPSTASH_TIMEOUT_MS);
      }),
    ]);
    return success ? null : tooManyRequests(limit, reset);
  } catch (err) {
    upstashDownUntil = Date.now() + UPSTASH_RETRY_AFTER_MS;
    console.error('[RateLimit] Upstash falló o tardó, uso el límite en memoria por 30 s:', err);
    return rateLimit(req, config);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Límites ya configurados para las rutas más sensibles (todos con `await`)
export const rateLimiters = {
  /** Formulario de contacto: 3 requests / 10 min */
  contact: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 3, windowSecs: 600, prefix: 'contact' }),

  /** Auth: 10 requests / 15 min */
  auth: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 10, windowSecs: 900, prefix: 'auth' }),

  /** Registro de cuenta: 5 requests / 60 min */
  register: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 5, windowSecs: 3600, prefix: 'register' }),

  /** Pedidos: 10 requests / 5 min */
  orders: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 10, windowSecs: 300, prefix: 'orders' }),

  /** Checkout: 5 requests / 5 min */
  checkout: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 5, windowSecs: 300, prefix: 'checkout' }),

  /** Notificaciones: 60 requests / 5 min (llamadas internas server-to-server) */
  notifications: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 60, windowSecs: 300, prefix: 'notifications' }),

  /** Subidas: 5 requests / 10 min */
  upload: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 5, windowSecs: 600, prefix: 'upload' }),

  /** Seguimiento de pedido (invitado): 8 requests / 10 min — frena fuerza bruta de ID+email */
  seguimiento: (req: NextRequest) =>
    rateLimitDistributed(req, { limit: 8, windowSecs: 600, prefix: 'seguimiento' }),
};
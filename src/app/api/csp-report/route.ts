import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { rateLimit } from '@/lib/rateLimit';
import { parseCspReports, violationField, type CspViolation } from '@/lib/cspReport';

/**
 * Receptor de reportes de violaciones de CSP del panel /admin.
 *
 * El navegador manda acá (report-uri) lo que la política estricta habría
 * bloqueado. Se cuentan en Upstash para poder revisar, después de unos días
 * en modo report-only, qué hay que permitir antes de pasar a 'enforce':
 *   - hash  csp:admin         → "directiva | bloqueado | página" = cantidad
 *   - hash  csp:admin:sample  → mismo campo = archivo:línea que lo intentó
 * (se ven en Upstash → Data Browser; vencen solos a los 14 días).
 *
 * Es un endpoint público (los navegadores no mandan credenciales de admin
 * garantizadas), así que: límite por IP, cuerpo acotado, entrada normalizada,
 * tope de campos distintos y siempre responde 204.
 */

const KEY        = 'csp:admin';
const SAMPLE_KEY = 'csp:admin:sample';
const TTL_SECS   = 14 * 24 * 3600;
const MAX_FIELDS = 300;
const MAX_BODY   = 8 * 1024;

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

async function record(r: Redis, v: CspViolation) {
  const field = violationField(v);
  const n = await r.hincrby(KEY, field, 1);
  if (n !== 1) return; // ya conocida: solo se sumó el contador (1 comando)

  // Campo nuevo: se acota la cantidad de campos distintos y se guarda la muestra.
  if ((await r.hlen(KEY)) > MAX_FIELDS) { await r.hdel(KEY, field); return; }
  await Promise.all([
    r.hset(SAMPLE_KEY, { [field]: v.source }),
    r.expire(KEY, TTL_SECS),
    r.expire(SAMPLE_KEY, TTL_SECS),
  ]);
  console.warn('[CSP admin] nueva violación:', field, '←', v.source);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 60, windowSecs: 60, prefix: 'csp-report' });
  if (limited) return limited;

  const text = (await req.text().catch(() => '')).slice(0, MAX_BODY);
  // Solo interesa el panel: descarta lo que no venga de una página /admin.
  const violations = parseCspReports(text).filter((v) => v.page.startsWith('/admin'));

  if (violations.length > 0) {
    const r = getRedis();
    try {
      if (r) await Promise.all(violations.map((v) => record(r, v)));
      else violations.forEach((v) => console.warn('[CSP admin]', violationField(v), '←', v.source));
    } catch (err) {
      console.error('[CSP admin] no se pudo guardar el reporte:', err);
    }
  }

  return new NextResponse(null, { status: 204 });
}
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/clientIp';

export const runtime = 'nodejs';

// Rutas que NO se registran (panel, login, APIs).
const IGNORED_PREFIXES = ['/admin', '/auth', '/api', '/mantenimiento'];
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|vercel|lighthouse|headless/i;

/**
 * Registra una visita: IP real + página + fecha/hora (created_at lo pone la DB).
 *
 * Lo llama <VisitTracker/> (layout raíz) en cada carga de página y en cada
 * navegación interna. Se hace desde una ruta aparte y NO desde proxy.ts a
 * propósito: el proxy corre en cada request (prefetch, datos RSC, bots) y
 * meter ahí una escritura a Supabase sumaría latencia a todo el sitio.
 *
 * Seguridad:
 *  - proxy.ts ya valida Origin (anti-CSRF) en los POST a /api/*.
 *  - Límite en memoria por IP (no usa Upstash a propósito: sería un comando
 *    de Redis por cada página vista y comería la cuota gratuita).
 *  - La ruta se normaliza: sin query string ni hash (pueden traer tokens o
 *    búsquedas personales) y solo paths internos.
 *  - Siempre responde 204, haya o no insertado: no filtra nada al cliente y
 *    un fallo del log nunca afecta la navegación.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 120, windowSecs: 60, prefix: 'visit' });
  if (limited) return limited;

  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const ip = getClientIp(req);
  if (!ip) return new NextResponse(null, { status: 204 });

  const body = await req.json().catch(() => null);
  const rawPath = typeof body?.path === 'string' ? body.path : '';
  const path = rawPath.split(/[?#]/)[0];

  const valid =
    path.startsWith('/') &&
    !path.startsWith('//') &&
    path.length <= 300 &&
    !IGNORED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
  if (!valid) return new NextResponse(null, { status: 204 });

  try {
    const { error } = await createAdminClient().from('visitor_logs').insert({ ip, path });
    if (error) console.error('[visit] insert falló:', error.message);
  } catch (err) {
    console.error('[visit] error inesperado:', err);
  }
  return new NextResponse(null, { status: 204 });
}

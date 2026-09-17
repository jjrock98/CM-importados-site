
import { NextRequest, NextResponse } from 'next/server';
import { secretsMatch } from '@/lib/secureCompare';
import { rateLimit } from '@/lib/rateLimit';
import { env } from '@/env';
import type { Product } from '@/types';

// ============================================================
// NOTA IMPORTANTE SOBRE LA UBICACIÓN DE ESTE ARCHIVO
// ============================================================
// Este proyecto es Next.js 16 con App Router (todo vive en `src/app/`),
// no Pages Router — acá no existe una carpeta `pages/`. El equivalente
// de `pages/api/webhooks/supabase-to-meta.js` en App Router es este
// archivo: `src/app/api/webhooks/supabase-to-meta/route.ts`, con un
// export nombrado `POST` en vez de un `export default` que revisa
// `req.method`. La URL pública final es la misma en los dos casos:
// https://mc-importados.shop/api/webhooks/supabase-to-meta

// v23.0 tiene soporte hasta oct. 2027 — se puede pisar con una env var
// sin tocar código el día que Meta la deprecie.
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';

// ============================================================
// TYPES — forma exacta en la que Supabase manda el Database Webhook
// ============================================================
// Supabase siempre manda esta forma para INSERT/UPDATE/DELETE:
//   INSERT → record = fila nueva,        old_record = null
//   UPDATE → record = fila nueva,        old_record = fila anterior
//   DELETE → record = null,              old_record = fila borrada
interface SupabaseWebhookPayload {
  type:  'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record:     Product | null;
  old_record: Product | null;
}

type MetaBatchMethod = 'CREATE' | 'UPDATE' | 'DELETE';

interface MetaBatchRequest {
  method: MetaBatchMethod;
  retailer_id: string;
  data?: Record<string, unknown>;
}

// ============================================================
// SECURITY — clave secreta por query param
// ============================================================
// Los Database Webhooks de Supabase no firman el request (a diferencia
// de Mercado Pago, ver api/webhooks/mercadopago), así que la única
// defensa es esta clave — se configura igual en Supabase (como parte
// de la URL del webhook) y en Vercel (env var), y se compara en tiempo
// constante con el mismo helper que ya usa el resto del proyecto
// (api/revalidate, api/cron/*) para evitar timing attacks.
function isAuthorized(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get('secret');
  return secretsMatch(secret, env.META_WEBHOOK_SECRET || null);
}

// ============================================================
// Supabase product row → objeto `data` que espera Meta
// ============================================================
function buildMetaData(p: Product) {
  // ── 1. Precio ──────────────────────────────────────────────
  // Regla de negocio pedida: enviar como entero incluyendo
  // centavos (75000 → 7500000). OJO: la documentación actual de
  // Meta para /items_batch que encontramos muestra el campo
  // `price` como STRING DECIMAL con 2 decimales + un campo
  // `currency` aparte (ej: "price": "75000.00", "currency": "ARS"),
  // no como entero×100. Puede que el catálogo de WhatsApp Business
  // específicamente sí pida el formato ×100 (varía según el
  // producto/superficie de Meta que se use) — antes de ir a
  // producción, probá con UN producto de prueba y confirmá en
  // Commerce Manager que el precio mostrado es el correcto; si
  // aparece 100 veces más caro (o más barato), es este cálculo.
  const precioCentavos = Math.round(p.precio_docena * 100);

  // ── 2. Título ──────────────────────────────────────────────
  // Opción A (default): nombre + sufijo aclaratorio.
  const title = `${p.nombre} (Por Docena)`;
  // Opción B (alternativa que mencionaste — descomentar para usar
  // la descripción corta como título si el producto tiene una
  // cargada, y si no, caer al nombre + sufijo):
  // const title = p.descripcion_corta?.trim() || `${p.nombre} (Por Docena)`;

  // ── 3. Imágenes ────────────────────────────────────────────
  // Ya son URLs públicas absolutas de Supabase Storage (no hace
  // falta armar la URL a mano). image_url = portada, el resto va
  // en additional_image_urls.
  const [imagenPrincipal, ...imagenesRestantes] = p.imagenes ?? [];

  return {
    // ── 4. País de origen ────────────────────────────────────
    // Hardcodeado a China por ahora, tal cual pediste. El día que
    // se necesite discriminar por marca/proveedor (ej. Luofu y
    // Henglumao son de China pero podría sumarse un proveedor de
    // Brasil), agregar una columna `pais_origen` a `products` en
    // Supabase y reemplazar esta línea por:
    //   origin_country: p.pais_origen ?? 'CN',
    origin_country: 'CN',

    name:         title,
    description:  p.descripcion?.trim() || p.descripcion_corta?.trim() || p.nombre,
    availability: p.activo && p.stock_unidades > 0 ? 'in stock' : 'out of stock',
    condition:    'new',
    price:        String(precioCentavos),
    currency:     'ARS',
    image_url:    imagenPrincipal ?? '',
    ...(imagenesRestantes.length > 0 ? { additional_image_urls: imagenesRestantes } : {}),
    url: `${env.APP_URL}/productos/${p.slug}`,

    // Meta suele pedir `category` (o `google_product_category`) para
    // aprobar los productos del todo — `categoria` (Calzado,
    // Pantalones, etc.) es lo más parecido que hay en el schema hoy;
    // puede necesitar mapearse a la taxonomía de Google/Meta más
    // adelante si Commerce Manager tira warnings de categoría.
    category: p.categoria,
  };
}

function buildBatchRequest(payload: SupabaseWebhookPayload): MetaBatchRequest | null {
  if (payload.type === 'DELETE') {
    if (!payload.old_record) return null;
    // Para DELETE, Meta solo quiere method + retailer_id — nada de `data`.
    return { method: 'DELETE', retailer_id: payload.old_record.id };
  }

  // INSERT o UPDATE
  if (!payload.record) return null;
  return {
    method: payload.type === 'INSERT' ? 'CREATE' : 'UPDATE',
    retailer_id: payload.record.id,
    data: buildMetaData(payload.record),
  };
}

// ============================================================
// Llamada a Meta — POST /{catalog_id}/items_batch
// ============================================================
async function sendToMeta(request: MetaBatchRequest) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.META_CATALOG_ID}/items_batch`;

  // Graph API espera form-urlencoded (igual que los ejemplos oficiales
  // con `-F` de curl), con `requests` como un array JSON-stringificado
  // — no como body JSON crudo.
  const body = new URLSearchParams({
    access_token: env.META_ACCESS_TOKEN,
    item_type: 'PRODUCT_ITEM',
    requests: JSON.stringify([request]),
  });

  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `Meta Graph API respondió ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`
    );
  }
  return data;
}

// ============================================================
// Handler
// ============================================================
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Rate limit liviano — esto lo llama Supabase, no un navegador, pero
  // sirve como defensa extra si alguien adivina/filtra el secreto.
  const limited = rateLimit(req, { limit: 60, windowSecs: 60, prefix: 'supabase-meta-webhook' });
  if (limited) return limited;

  if (!env.META_ACCESS_TOKEN || !env.META_CATALOG_ID) {
    console.error('[supabase-to-meta] Faltan META_ACCESS_TOKEN o META_CATALOG_ID en las env vars.');
    return NextResponse.json({ error: 'Integración con Meta no configurada' }, { status: 500 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Solo nos importa la tabla de productos — Supabase permite configurar
  // el webhook para que dispare solo con esa tabla, pero chequeamos
  // igual acá por si el día de mañana se agregan más webhooks a otras
  // tablas apuntando a esta misma URL por error.
  if (payload.table !== 'products') {
    return NextResponse.json({ skipped: true, reason: 'tabla ignorada' });
  }

  const batchRequest = buildBatchRequest(payload);
  if (!batchRequest) {
    return NextResponse.json({ skipped: true, reason: 'payload sin record/old_record' });
  }

  try {
    const metaResponse = await sendToMeta(batchRequest);
    return NextResponse.json({ ok: true, meta: metaResponse });
  } catch (err) {
    console.error('[supabase-to-meta] Error al sincronizar con Meta:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido al llamar a Meta' },
      { status: 502 }
    );
  }
}
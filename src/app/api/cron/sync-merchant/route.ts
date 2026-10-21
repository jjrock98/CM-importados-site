import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { secretsMatch } from '@/lib/secureCompare';
import {
  CONTENT_LANGUAGE, FEED_LABEL, getMerchantConfig,
  insertProductInput, deleteProductInput, type MerchantProductInput,
} from '@/lib/merchant';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BRAND = 'MC importados';
const UNITS_PER_DOZEN = 12;
const CONCURRENCY = 5;

interface ProductRow {
  id: string; nombre: string; slug: string;
  descripcion: string | null; descripcion_corta: string | null;
  imagenes: string[] | null; stock_unidades: number;
  precio_docena: number | null; precio_unitario: number | null;
  venta_minorista: boolean | null; categoria: string | null;
}

const clean = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Convierte un producto de la tienda al formato de Merchant Center.
 * Devuelve null si le falta algo obligatorio (imagen o precio).
 *
 * Regla de precio (DECISIÓN DE NEGOCIO, ajustable acá):
 *  - Si se vende por unidad (venta_minorista + precio_unitario) → precio por unidad.
 *  - Si no → se publica la DOCENA: precio_docena, título "(docena x12)" y multipack=12.
 */
function toProductInput(p: ProductRow, appUrl: string): MerchantProductInput | null {
  const porUnidad = !!p.venta_minorista && (p.precio_unitario ?? 0) > 0;
  const price = porUnidad ? Number(p.precio_unitario) : Number(p.precio_docena ?? 0);
  const unidadesPorVenta = porUnidad ? 1 : UNITS_PER_DOZEN;

  const imgs = (p.imagenes ?? [])
    .filter(Boolean)
    .map((u) => (u.startsWith('http') ? u : `${appUrl}${u.startsWith('/') ? '' : '/'}${u}`));
  if (!imgs.length || !(price > 0)) return null;

  const baseTitle = clean(p.nombre);
  const title = (porUnidad ? baseTitle : `${baseTitle} (docena x${UNITS_PER_DOZEN})`).slice(0, 150);
  const description = clean(p.descripcion || p.descripcion_corta || p.nombre).slice(0, 5000);

  return {
    offerId: p.id,
    contentLanguage: CONTENT_LANGUAGE,
    feedLabel: FEED_LABEL,
    productAttributes: {
      title,
      description,
      link: `${appUrl}/productos/${p.slug}`,
      imageLink: imgs[0],
      ...(imgs.length > 1 ? { additionalImageLinks: imgs.slice(1, 11) } : {}),
      availability: p.stock_unidades >= unidadesPorVenta ? 'IN_STOCK' : 'OUT_OF_STOCK',
      condition: 'NEW',
      price: { amountMicros: String(Math.round(price * 1_000_000)), currencyCode: 'ARS' },
      brand: BRAND,
      identifierExists: false,
      ...(porUnidad ? {} : { multipack: String(UNITS_PER_DOZEN) }),
      ...(p.categoria ? { productTypes: [p.categoria] } : {}),
    },
  };
}

/**
 * Sincroniza el catálogo con Google Merchant Center (una vía: tienda → Google).
 * Corre diario por Vercel Cron. También se puede lanzar a mano:
 *   /api/cron/sync-merchant?secret=<REVALIDATE_SECRET_TOKEN>
 *   /api/cron/sync-merchant?secret=...&dry=1   → muestra qué enviaría, sin llamar a Google
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const ok =
    secretsMatch(req.nextUrl.searchParams.get('secret'), process.env.REVALIDATE_SECRET_TOKEN) ||
    secretsMatch(bearer, process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const cfg = getMerchantConfig();
  if (!cfg && !dry) {
    // Todavía no se configuró Google: no es un error, el cron simplemente no hace nada.
    return NextResponse.json({ skipped: true, reason: 'Faltan variables GOOGLE_* en Vercel' });
  }

  // Los links de producto tienen que estar en el MISMO dominio que se verificó y
  // reclamó en Merchant Center (con www). Si APP_URL apunta al dominio sin www,
  // Google rechaza los links, por eso acá se fija el dominio reclamado.
  const appUrl = (process.env.GOOGLE_MERCHANT_SITE_URL || 'https://www.mc-importados.shop').replace(/\/$/, '');
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('products')
    .select('id, nombre, slug, descripcion, descripcion_corta, imagenes, stock_unidades, precio_docena, precio_unitario, venta_minorista, categoria, activo');
  if (error) {
    console.error('[sync-merchant] no se pudieron leer los productos:', error.message);
    return NextResponse.json({ error: 'No se pudieron leer los productos' }, { status: 500 });
  }

  const rows = (data ?? []) as (ProductRow & { activo: boolean })[];
  const toSend: MerchantProductInput[] = [];
  const toRemove: string[] = [];
  const skipped: string[] = [];

  for (const r of rows) {
    const input = r.activo ? toProductInput(r, appUrl) : null;
    if (input) toSend.push(input);
    else {
      toRemove.push(r.id); // inactivo o sin imagen/precio: que no figure en Google
      if (r.activo) skipped.push(r.nombre);
    }
  }

  if (dry) {
    return NextResponse.json({
      dry: true, aEnviar: toSend.length, aQuitar: toRemove.length,
      omitidosPorFaltarImagenOPrecio: skipped.slice(0, 20),
      ejemplo: toSend.slice(0, 3),
    });
  }

  const errors: { offerId: string; status: number; error?: string }[] = [];
  let sent = 0, removed = 0;

  for (let i = 0; i < toSend.length; i += CONCURRENCY) {
    const results = await Promise.all(
      toSend.slice(i, i + CONCURRENCY).map((inp) => insertProductInput(cfg!, inp).catch((e) => ({ ok: false, status: 0, error: String(e) }))),
    );
    results.forEach((res, k) => {
      if (res.ok) sent++;
      else errors.push({ offerId: toSend[i + k].offerId, status: res.status, error: res.error });
    });
  }
  for (let i = 0; i < toRemove.length; i += CONCURRENCY) {
    const results = await Promise.all(
      toRemove.slice(i, i + CONCURRENCY).map((id) => deleteProductInput(cfg!, id).catch((e) => ({ ok: false, status: 0, error: String(e) }))),
    );
    results.forEach((res, k) => {
      if (res.ok) removed++;
      else errors.push({ offerId: toRemove[i + k], status: res.status, error: res.error });
    });
  }

  if (errors.length) console.error('[sync-merchant] errores:', JSON.stringify(errors.slice(0, 5)));
  return NextResponse.json({ enviados: sent, quitados: removed, errores: errors.length, detalleErrores: errors.slice(0, 5) });
}
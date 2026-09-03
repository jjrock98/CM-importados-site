import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * On-demand revalidation endpoint.
 *
 * GET  /api/revalidate?secret=TOKEN&path=/          (uso manual / cron)
 * GET  /api/revalidate?secret=TOKEN&tag=products
 * POST /api/revalidate?secret=TOKEN&slug=nombre-producto
 *      → limpia /productos/[slug], / y /minorista de una — pensado para
 *        integraciones (CMS, webhook de stock, etc.) que avisan "cambió
 *        este producto puntual" sin tener que refrescar todo el sitio.
 * POST /api/revalidate?secret=TOKEN  (sin slug) → limpia el layout global
 *
 * Also called nightly by Vercel Cron (see vercel.json).
 * Add REVALIDATE_SECRET_TOKEN to env vars.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  const path   = req.nextUrl.searchParams.get('path');
  const tag    = req.nextUrl.searchParams.get('tag');

  // Verify secret
  if (secret !== process.env.REVALIDATE_SECRET_TOKEN) {
    return NextResponse.json({ message: 'Token inválido' }, { status: 401 });
  }

  try {
    if (tag) {
      // ✅ Next 16: revalidateTag ahora requiere un segundo parámetro
      // "profile" (parte de la nueva Cache Components API). Usamos
      // { expire: 0 } para replicar el comportamiento anterior:
      // purgar el tag inmediatamente, sin la nueva semántica de
      // cache opt-in que este proyecto no utiliza.
      revalidateTag(tag, { expire: 0 });
      return NextResponse.json({ revalidated: true, tag, now: Date.now() });
    }

    if (path) {
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, path, now: Date.now() });
    }

    // Full revalidation (called by cron)
    const paths = ['/', '/productos', '/ubicacion', '/contacto', '/faq'];
    paths.forEach((p) => revalidatePath(p));

    return NextResponse.json({
      revalidated: true,
      paths,
      now: Date.now(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Revalidation failed' },
      { status: 500 }
    );
  }
}

/**
 * POST — revalidación bajo demanda orientada a un producto puntual.
 * Acepta el secret y/o el slug tanto por query string como por body JSON
 * (más cómodo para webhooks que arman el body en vez de la URL).
 */
export async function POST(req: NextRequest) {
  let bodySlug: string | null = null;
  let bodySecret: string | null = null;
  try {
    const body = await req.json();
    bodySlug   = typeof body?.slug === 'string' ? body.slug : null;
    bodySecret = typeof body?.secret === 'string' ? body.secret : null;
  } catch {
    // Body vacío o no-JSON — se usa lo que venga por query string.
  }

  const secret = req.nextUrl.searchParams.get('secret') ?? bodySecret;
  const slug   = req.nextUrl.searchParams.get('slug')   ?? bodySlug;

  if (secret !== process.env.REVALIDATE_SECRET_TOKEN) {
    return NextResponse.json({ message: 'Token inválido' }, { status: 401 });
  }

  try {
    if (slug) {
      const paths = [`/productos/${slug}`, '/', '/minorista'];
      paths.forEach((p) => revalidatePath(p));
      return NextResponse.json({ revalidated: true, slug, paths, now: Date.now() });
    }

    // Sin slug → revalida el layout global completo
    revalidatePath('/', 'layout');
    return NextResponse.json({ revalidated: true, scope: 'layout', now: Date.now() });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Revalidation failed' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/**
 * Foto del producto lista para vista previa de enlaces (og:image).
 *
 * Por qué existe: /_next/image elige el formato según el header Accept del
 * que pide, y los rastreadores de Facebook/WhatsApp aceptan "cualquier formato", así que
 * recibían AVIF — un formato que no soportan ("tipo de contenido no válido"
 * en el Depurador de Meta). Acá se devuelve SIEMPRE un JPEG, y se lo achica
 * hasta que pese poco (WhatsApp descarta imágenes de vista previa muy
 * pesadas, ~300 KB).
 *
 * Solo acepta fotos del storage público de Supabase (evita que se use como
 * proxy abierto hacia cualquier URL).
 */
export const runtime = 'nodejs';

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const TARGET_BYTES     = 280 * 1024;

function isAllowedSource(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const ok =
      u.protocol === 'https:' &&
      u.hostname.endsWith('.supabase.co') &&
      u.pathname.startsWith('/storage/v1/object/public/');
    return ok ? u : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const src = isAllowedSource(req.nextUrl.searchParams.get('src'));
  if (!src) return new NextResponse('Bad request', { status: 400 });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const upstream = await fetch(src, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error('[og-photo] origen respondió', upstream.status, src.href);
      return new NextResponse(`og-photo: el origen respondió ${upstream.status}`, { status: 404 });
    }
    const len = Number(upstream.headers.get('content-length') ?? 0);
    if (len > MAX_SOURCE_BYTES) return new NextResponse('Too large', { status: 413 });

    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return new NextResponse('Too large', { status: 413 });

    // Fondo blanco (por si la foto tiene transparencia) y se respeta la
    // orientación EXIF de las fotos sacadas con celular.
    const base = sharp(input)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' });

    // JPEG "baseline" clásico (sin progresivo ni mozjpeg): es el formato que
    // aceptan hasta los rastreadores de vista previa más estrictos.
    const encode = (quality: number) =>
      base.clone().jpeg({ quality, progressive: false, mozjpeg: false, chromaSubsampling: '4:2:0' }).toBuffer();

    let out = await encode(78);
    for (const q of [66, 55, 45, 38]) {
      if (out.length <= TARGET_BYTES) break;
      out = await encode(q);
    }

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      },
    });
  } catch (err) {
    // Se registra en los logs de Vercel y se devuelve el motivo en texto
    // para poder diagnosticar abriendo la URL en el navegador.
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[og-photo] fallo al procesar', src.href, msg);
    return new NextResponse(`og-photo error: ${msg}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
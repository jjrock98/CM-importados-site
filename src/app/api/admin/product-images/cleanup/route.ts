import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/verifyAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Borra del storage ("products") las imágenes que ya no usa nadie.
 *
 * Se llama desde el panel de admin cuando:
 *  - se reemplaza una imagen (recorte/rotación) y el producto se guarda, o
 *  - se cancela el formulario después de haber subido imágenes nuevas.
 *
 * ⚠️ Nunca se borra "a ciegas": antes de eliminar cada archivo se verifica que
 * ninguna otra cosa lo siga usando. Una misma URL puede estar en:
 *   - otro producto (el botón "duplicar" copia las URLs de imágenes),
 *   - una variante (product_variants.imagen_url),
 *   - pedidos viejos (order_items.imagen_snap guarda la foto tal como se vendió).
 * Si está en cualquiera de esos lugares se conserva.
 */

const MAX_URLS = 30;

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
  const prefix = `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/products/`;

  let body: { urls?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }); }

  const urls = Array.isArray(body.urls)
    ? [...new Set(body.urls.filter((u): u is string => typeof u === 'string' && u.length < 600))].slice(0, MAX_URLS)
    : [];

  // Solo se aceptan URLs del bucket "products" de ESTE proyecto de Supabase.
  const candidates = urls
    .filter((u) => u.startsWith(prefix))
    .map((u) => {
      const raw = u.slice(prefix.length).split('?')[0].split('#')[0];
      try { return { url: u, path: decodeURIComponent(raw) }; } catch { return null; }
    })
    .filter((c): c is { url: string; path: string } => !!c && c.path.length > 0 && !c.path.includes('..'));

  if (candidates.length === 0) return NextResponse.json({ deleted: 0, kept: 0 });

  const admin = createAdminClient();

  // ── ¿Quién más usa estas imágenes? ──────────────────────────────────────
  const inUse = new Set<string>();

  const [{ data: prods, error: e1 }, { data: vars, error: e2 }, { data: snaps, error: e3 }] = await Promise.all([
    admin.from('products').select('imagenes'),
    admin.from('product_variants').select('imagen_url').not('imagen_url', 'is', null),
    admin.from('order_items').select('imagen_snap').in('imagen_snap', candidates.map((c) => c.url)),
  ]);
  // Si no se pudo verificar algo, NO se borra nada (mejor ocupar espacio que romper fotos).
  if (e1 || e2 || e3) {
    return NextResponse.json({ error: 'No se pudo verificar el uso de las imágenes' }, { status: 500 });
  }

  for (const p of prods ?? []) for (const u of (p.imagenes as string[] | null) ?? []) inUse.add(u);
  for (const v of vars ?? []) if (v.imagen_url) inUse.add(v.imagen_url as string);
  for (const s of snaps ?? []) if (s.imagen_snap) inUse.add(s.imagen_snap as string);

  const toDelete = candidates.filter((c) => !inUse.has(c.url));
  if (toDelete.length === 0) return NextResponse.json({ deleted: 0, kept: candidates.length });

  const { error } = await admin.storage.from('products').remove(toDelete.map((c) => c.path));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: toDelete.length, kept: candidates.length - toDelete.length });
}
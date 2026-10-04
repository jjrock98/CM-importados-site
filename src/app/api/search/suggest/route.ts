import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { rateLimit } from '@/lib/rateLimit';
import { searchProducts } from '@/lib/searchProducts';

/**
 * Sugerencias del buscador mientras la persona escribe (SearchAutocomplete).
 * Devuelve hasta 6 productos activos cuyo nombre contiene el texto.
 *
 * - Usa el cliente público (sin cookies): son datos que ya ven todos.
 * - Mismo criterio que /buscar: activo + venta_mayorista.
 * - Ignora acentos y mayúsculas; el texto se limpia de caracteres especiales.
 * - Límite por IP + caché corta en el CDN para no castigar la base de datos
 *   (el navegador dispara un pedido por pausa al tipear).
 */
export const dynamic = 'force-dynamic';

const MAX_SUGGESTIONS = 6;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 60, windowSecs: 60, prefix: 'search-suggest' });
  if (limited) return limited;

  const q = req.nextUrl.searchParams.get('q') ?? '';

  // Ignora acentos ("pantalon" encuentra "Pantalón") y limpia caracteres
  // especiales — ver src/lib/searchProducts.ts y sql/search_products.sql.
  const supabase = createPublicClient();
  const rows = await searchProducts<{
    nombre: string; slug: string; imagenes: string[] | null; precio_docena: number | null;
  }>(supabase, q, {
    columns: 'nombre, slug, imagenes, precio_docena',
    limit: MAX_SUGGESTIONS,
  });

  const items = rows.map((p) => ({
    nombre: p.nombre,
    slug: p.slug,
    imagen: p.imagenes?.[0] ?? null,
    precio_docena: p.precio_docena,
  }));

  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  );
}
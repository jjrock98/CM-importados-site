import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Limpia el texto que escribe la persona antes de usarlo en una búsqueda.
 * Saca los caracteres con significado especial en ILIKE (% _ \) y en los
 * filtros de PostgREST (coma, paréntesis, asterisco, comillas dobles): con
 * ellos, una búsqueda como "remera (azul)" o "a,b" rompía el filtro .or().
 */
export function sanitizeSearchText(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/[%_,()\\*"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

interface SearchOptions {
  /** Columnas a traer (default: todas). */
  columns?: string;
  /** También buscar en descripcion / descripcion_corta (default: solo nombre). */
  includeDescription?: boolean;
  limit?: number;
}

/**
 * Busca productos activos de venta mayorista, ignorando acentos y mayúsculas.
 *
 * Usa la función SQL `search_products` (ver sql/search_products.sql). Si la
 * función todavía no fue creada en Supabase, o falla, cae a una búsqueda
 * ILIKE común — funciona igual, solo que sin ignorar acentos.
 */
export async function searchProducts<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  rawQuery: string,
  { columns = '*', includeDescription = false, limit = 40 }: SearchOptions = {}
): Promise<T[]> {
  const term = sanitizeSearchText(rawQuery);
  if (term.length < 2) return [];

  const { data, error } = await supabase
    .rpc('search_products', {
      q: term,
      include_description: includeDescription,
      max_results: limit,
    })
    .select(columns);

  if (!error) return (data ?? []) as unknown as T[];

  // Fallback: la función no existe (aún) o falló.
  let qb = supabase
    .from('products')
    .select(columns)
    .eq('activo', true)
    .eq('venta_mayorista', true);

  qb = includeDescription
    ? qb.or(
        `nombre.ilike.%${term}%,` +
        `descripcion.ilike.%${term}%,` +
        `descripcion_corta.ilike.%${term}%`
      )
    : qb.ilike('nombre', `%${term}%`);

  const { data: fallback } = await qb
    .order('destacado', { ascending: false })
    .order('stock_unidades', { ascending: false })
    .limit(limit);

  return (fallback ?? []) as unknown as T[];
}
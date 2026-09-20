import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ✅ Cliente de Supabase para datos PÚBLICOS leídos desde Server Components
// que no dependen del usuario (ej: contact_info en el Footer).
//
// A diferencia de `@/lib/supabase/server`, este NO llama a cookies() de
// next/headers. Eso es a propósito: sin Partial Prerendering activado en
// next.config.js, usar cookies() en cualquier parte del árbol de una ruta
// —aunque esté envuelta en <Suspense>— fuerza a TODA esa ruta a
// renderizado dinámico (ƒ) en vez de estático (○), incluso en páginas de
// puro contenido como /faq, /terminos o /politicas.
//
// Usar solo para lecturas que ya son públicas por policy de RLS (mismo
// alcance que ya tenían vía el cliente con cookies, pero sin sesión de
// usuario). Para operaciones que SÍ necesitan al usuario logueado, seguir
// usando `@/lib/supabase/server` como hasta ahora.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
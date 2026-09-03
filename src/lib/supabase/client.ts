import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// ✅ Singleton: evita "Multiple GoTrueClient instances detected" y
// previene desincronización de sesión entre hooks/componentes que
// llaman createClient() en cada render (useAuth, useWishlist,
// useRealtimeOrders, EmailVerificationBanner, Navbar, etc.)
let client: SupabaseClient | undefined;

export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}

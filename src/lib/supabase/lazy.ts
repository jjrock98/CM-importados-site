import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Carga perezosa del cliente de Supabase para el NAVEGADOR.
 *
 * Por qué existe: `@supabase/ssr` + `supabase-js` pesan ~66 KiB gzip
 * (auth, postgrest, storage, realtime). Si un componente que vive en el
 * layout raíz lo importa de forma estática, TODAS las páginas lo descargan
 * antes de hidratar — incluso para un visitante anónimo que nunca lo usa.
 * Con `import()` dinámico el código solo se baja cuando hace falta.
 *
 * Usar en componentes/hooks que se montan en todas las páginas (Navbar,
 * banner de verificación, tarjetas de producto, carrito). Las páginas que
 * SÍ necesitan Supabase de entrada (login, checkout, admin) pueden seguir
 * importando `createClient` directo de './client'.
 */
export async function getSupabase(): Promise<SupabaseClient> {
  const { createClient } = await import('./client');
  return createClient();
}

/**
 * ¿Hay una sesión de Supabase guardada en cookies? Las cookies de
 * @supabase/ssr se llaman `sb-<ref>-auth-token` (o `.0`, `.1`… si la
 * sesión es larga) y NO son httpOnly, así que el navegador las puede leer.
 * Sin esa cookie no hay nadie logueado: se evita cargar Supabase solo para
 * descubrir que el visitante es anónimo.
 */
export function hasSupabaseSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return /(?:^|;\s*)sb-[^=;]+-auth-token/.test(document.cookie);
}

let warmupInstalled = false;

/**
 * Para visitantes anónimos: baja el chunk de Supabase en segundo plano en
 * cuanto hacen algo (tocar, click, teclear). Así, cuando agregan algo al
 * carrito o abren un producto, el código ya está en caché y no notan la
 * carga diferida. No corre solo por cargar la página, por eso no pesa en
 * la carga inicial ni en las métricas de PageSpeed.
 */
export function warmSupabaseOnInteraction(): void {
  if (warmupInstalled || typeof window === 'undefined') return;
  warmupInstalled = true;
  const events = ['pointerdown', 'touchstart', 'keydown'] as const;
  const warm = () => {
    events.forEach((e) => window.removeEventListener(e, warm));
    void import('./client');
  };
  events.forEach((e) => window.addEventListener(e, warm, { passive: true, once: true }));
}
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  getSupabase,
  hasSupabaseSessionCookie,
  warmSupabaseOnInteraction,
} from '@/lib/supabase/lazy';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

export function useAuth(options?: { revalidateOnNavigate?: boolean }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirstNav = useRef(true);
  const alive = useRef(true);
  const subscription = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      subscription.current?.unsubscribe();
      subscription.current = null;
    };
  }, []);

  // ✅ PERF: Supabase (~66 KiB gzip) ya no se importa de forma estática. Si
  // no hay cookie de sesión, el visitante es anónimo: no se descarga nada y
  // `loading` pasa a false enseguida. Si hay cookie, se carga Supabase y se
  // hace exactamente lo mismo que antes (getUser() contra el servidor +
  // perfil + listener de cambios de sesión).
  const refresh = useCallback(async () => {
    if (!hasSupabaseSessionCookie()) {
      warmSupabaseOnInteraction();
      if (!alive.current) return;
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const supabase = await getSupabase();
    if (!alive.current) return;

    // ✅ FIX (bug: el menú de usuario del Navbar seguía mostrando la sesión
    // iniciada aunque el servidor ya la hubiera cerrado — ej. por el
    // timeout de inactividad que aplica el middleware — y entrar a /perfil
    // te mandaba al login igual). La causa: se confiaba directo en
    // `session.user`, el objeto que entrega este evento — y la propia
    // librería de Supabase advierte que ese valor sale de lo que ya había
    // en cookies/localStorage, SIN confirmarlo con el servidor de Auth.
    // Cuando el middleware cierra una sesión, lo hace con su propio
    // cliente de Supabase, en un request de servidor completamente
    // aparte — el SDK de este navegador nunca se entera solo, porque no
    // fue él quien llamó a signOut(). Se revalida con getUser() (sí
    // confirma contra el servidor) antes de dar por buena la sesión.
    // El setTimeout(…, 0) es el patrón que documenta Supabase para hacer
    // llamadas async acá adentro: llamarlas directo puede colgar el SDK
    // (deadlock conocido de su librería de auth).
    // La suscripción se crea una sola vez por instancia del hook.
    if (!subscription.current) {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'SIGNED_OUT' || !session) {
            if (!alive.current) return;
            setUser(null);
            setProfile(null);
            return;
          }
          setTimeout(async () => {
            const { data: { user: verifiedUser } } = await supabase.auth.getUser();
            if (!alive.current) return;
            setUser(verifiedUser);
            if (verifiedUser) {
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', verifiedUser.id)
                .single();
              if (alive.current) setProfile(data);
            } else {
              setProfile(null);
            }
          }, 0);
        }
      );
      subscription.current = sub;
    }

    const { data: { user: verifiedUser } } = await supabase.auth.getUser();
    if (!alive.current) return;
    setUser(verifiedUser);
    if (verifiedUser) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', verifiedUser.id)
        .single();
      if (!alive.current) return;
      setProfile(data);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ✅ NUEVO: mismo bug de arriba, pero para el caso en que el cierre de
  // sesión del servidor pasó hace rato y ni siquiera hay un evento nuevo
  // que dispare el listener — el usuario navega de una página a otra y el
  // Navbar (nunca se desmonta, vive en el layout raíz) sigue mostrando
  // para siempre el estado con el que arrancó. Revalidar en cada cambio de
  // ruta es "opt-in" (revalidateOnNavigate) a propósito: este hook también
  // lo usa cada ProductCard (y de nuevo adentro de useWishlist) — en una
  // grilla de productos eso son varias decenas de instancias por página.
  // Solo el Navbar lo activa: es el único lugar persistente donde el
  // desfasaje se nota y se puede arrastrar por toda la sesión de navegación.
  // Además, esto es lo que detecta un login hecho sin recargar la página:
  // al navegar aparece la cookie de sesión y ahí recién se carga Supabase.
  useEffect(() => {
    if (!options?.revalidateOnNavigate) return;
    // El efecto de arriba ya cubre el primer montaje — acá solo nos
    // interesan los cambios de ruta POSTERIORES.
    if (isFirstNav.current) { isFirstNav.current = false; return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const signOut = async () => {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.rol === 'admin';
  const isProfileComplete =
    !!profile?.direccion && !!profile?.codigo_postal && !!profile?.telefono;

  return { user, profile, loading, isAdmin, isProfileComplete, signOut };
}
'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

export function useAuth(options?: { revalidateOnNavigate?: boolean }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirstNav = useRef(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    };
    init();

    // ✅ FIX (bug: el menú de usuario del Navbar seguía mostrando la sesión
    // iniciada aunque el servidor ya la hubiera cerrado — ej. por el
    // timeout de inactividad que aplica el middleware — y entrar a /perfil
    // te mandaba al login igual). La causa: acá abajo se confiaba directo
    // en `session.user`, el objeto que entrega este evento — y la propia
    // librería de Supabase advierte que ese valor sale de lo que ya había
    // en cookies/localStorage, SIN confirmarlo con el servidor de Auth.
    // Cuando el middleware cierra una sesión, lo hace con su propio
    // cliente de Supabase, en un request de servidor completamente
    // aparte — el SDK de este navegador nunca se entera solo, porque no
    // fue él quien llamó a signOut(). Ahora se revalida con getUser()
    // (sí confirma contra el servidor) antes de dar por buena la sesión.
    // El setTimeout(…, 0) es el patrón que documenta Supabase para hacer
    // llamadas async acá adentro: llamarlas directo puede colgar el SDK
    // (deadlock conocido de su librería de auth).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setProfile(null);
          return;
        }
        setTimeout(async () => {
          const { data: { user: verifiedUser } } = await supabase.auth.getUser();
          setUser(verifiedUser);
          if (verifiedUser) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', verifiedUser.id)
              .single();
            setProfile(data);
          } else {
            setProfile(null);
          }
        }, 0);
      }
    );
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ NUEVO: mismo bug de arriba, pero para el caso en que el cierre de
  // sesión del servidor pasó hace rato y ni siquiera hay un evento nuevo
  // que dispare el listener de arriba — el usuario navega de una página a
  // otra y el Navbar (nunca se desmonta, vive en el layout raíz) sigue
  // mostrando para siempre el estado con el que arrancó. Revalidar en cada
  // cambio de ruta es "opt-in" (revalidateOnNavigate) a propósito: este
  // hook también lo usa cada ProductCard (y de nuevo adentro de
  // useWishlist) — en una grilla de productos eso son varias decenas de
  // instancias por página. Si esto corriera para todas, cada navegación
  // dispararía esa misma cantidad de llamadas a Supabase de más. Solo el
  // Navbar lo activa: es el único lugar persistente donde el desfasaje se
  // nota y se puede arrastrar por toda la sesión de navegación.
  useEffect(() => {
    if (!options?.revalidateOnNavigate) return;
    // init() (efecto de arriba) ya cubre el primer montaje — acá solo nos
    // interesan los cambios de ruta POSTERIORES, si no, cada carga de
    // página dispararía el chequeo dos veces en simultáneo.
    if (isFirstNav.current) { isFirstNav.current = false; return; }
    let cancelled = false;
    (async () => {
      const { data: { user: verifiedUser } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(verifiedUser);
      if (verifiedUser) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', verifiedUser.id)
          .single();
        if (!cancelled) setProfile(data);
      } else {
        setProfile(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.rol === 'admin';
  const isProfileComplete =
    !!profile?.direccion && !!profile?.codigo_postal && !!profile?.telefono;

  return { user, profile, loading, isAdmin, isProfileComplete, signOut, supabase };
}
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, Chrome, Facebook } from 'lucide-react';
import toast from 'react-hot-toast';
import { TurnstileWidget } from '@/components/common/TurnstileWidget';

export default function LoginPage() {
  const params   = useSearchParams();
  const redirect = params.get('redirect') ?? '/';
  const supabase = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // ✅ NUEVO: hasta ahora esta página nunca chequeaba si ya había una
  // sesión activa al cargar. Es la causa más probable del bug reportado
  // ("me dice bienvenido pero sigo en el login, recién en el segundo
  // refresh entra"): si por conexión lenta o un refresh justo en medio
  // del login la sesión termina puesta en el navegador ANTES de que esta
  // página llegue a redirigir, no había nada que lo detectara al volver
  // a cargar /auth/login — se mostraba el formulario igual, sin importar
  // que ya hubiera sesión, hasta que en algún momento posterior (el
  // segundo refresh) todo terminaba de sincronizar por las suyas.
  // Ahora, apenas monta la página, se fija con supabase.auth.getUser()
  // (mismo chequeo que ya usa useAuth() — valida contra el servidor de
  // Supabase, no confía en un estado local que podría estar desactualizado)
  // si ya hay sesión, y si la hay, redirige de una — sin mostrar el
  // formulario ni esperar a que la persona intente loguearse de nuevo.
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (user) {
        window.location.href = redirect;
      } else {
        setCheckingSession(false);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ NUEVO: aviso cuando el middleware redirige acá por inactividad
  // (ver ADMIN_IDLE_LIMIT_SECONDS en middleware.ts)
  useEffect(() => {
    if (params.get('expired') === '1') {
      toast('Tu sesión se cerró por inactividad. Volvé a iniciar sesión.', { icon: '⏱️' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      toast.error('Completá la verificación anti-bot antes de ingresar.');
      return;
    }
    setLoading(true);
    // ✅ FIX: antes llamaba a supabase.auth.signInWithPassword() directo
    // desde acá — imposible ponerle un límite de intentos propio. Ahora
    // pasa por /api/auth/login, que aplica captcha + el freno de intentos
    // antes de reenviar a Supabase (10 intentos / 15 min por IP).
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken: captchaToken }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(
        res.status === 429
          ? 'Demasiados intentos — esperá unos minutos antes de volver a intentar.'
          : json.error ?? 'Error al iniciar sesión. Intentá de nuevo.'
      );
      setCaptchaToken(null);
    } else {
      toast.success('¡Bienvenido!');
      // ✅ FIX: acá antes había router.push(redirect) + router.refresh().
      // El problema: el login ahora pasa por /api/auth/login (fetch al
      // servidor) en vez de supabase.auth.signInWithPassword() llamado
      // directo desde el navegador. Antes, esa llamada directa disparaba
      // el evento onAuthStateChange del SDK de Supabase en el cliente,
      // que es lo que useAuth() escucha para actualizar user/profile — así
      // se enteraba React de que había sesión. Ahora que el login lo hace
      // el servidor, el navegador nunca se entera: la cookie de sesión SÍ
      // queda puesta bien, pero el cliente de Supabase en memoria (y por
      // lo tanto useAuth(), el Navbar, "Mi Cuenta", etc.) sigue creyendo
      // que no hay usuario, porque nada le avisó del cambio.
      // router.refresh() no alcanza para arreglar esto: solo vuelve a
      // pedir los Server Components de la ruta actual, no fuerza a los
      // Client Components ya montados (como el Navbar, que vive en el
      // layout raíz y nunca se desmonta al navegar) a re-ejecutar su
      // useEffect y leer la sesión de nuevo.
      // La solución confiable es forzar una recarga completa del
      // navegador: tira abajo todo el estado de JS (incluido el cliente
      // de Supabase en memoria) y arranca de cero, leyendo la cookie de
      // sesión que el servidor ya dejó puesta. Por eso window.location en
      // vez de router.push — acá SÍ conviene sacrificar la navegación
      // suave de Next.js a cambio de que el login funcione de verdad.
      window.location.href = redirect;
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
    });
  };

  // ✅ NUEVO: mismo patrón que Google — Supabase se encarga de todo el
  // intercambio OAuth, el callback (/auth/callback) ya es genérico y no
  // necesita ningún cambio para soportar un provider más.
  const handleFacebook = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options:  { redirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
    });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      {checkingSession ? (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-label="Verificando sesión…" />
      ) : (
      <div className="card w-full max-w-md p-8 animate-scale-in">
        <h1 className="font-display text-2xl font-bold text-center mb-1">Ingresar</h1>
        <p className="text-center text-sm text-muted mb-8">Accedé a tu cuenta para continuar</p>

        {/* Google */}
        <button onClick={handleGoogle} className="btn-secondary w-full mb-3 gap-3">
          <Chrome size={18} className="text-red-500" />
          Continuar con Google
        </button>

        {/* Facebook */}
        <button onClick={handleFacebook} className="btn-secondary w-full mb-4 gap-3">
          <Facebook size={18} className="text-blue-600" />
          Continuar con Facebook
        </button>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs text-muted">
            <span className="bg-surface px-2">o con email</span>
          </div>
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com" className="input-base pl-10"
              autoComplete="email"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type={showPw ? 'text' : 'password'} required value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña" className="input-base pl-10 pr-10"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* ✅ Fixed: forgot password link */}
          <div className="flex justify-end">
            <Link
              href="/auth/reset-password"
              className="text-xs text-muted hover:text-brand-600 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} className="flex justify-center" />

          <button type="submit" disabled={loading || !captchaToken} className="btn-primary w-full">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿No tenés cuenta?{' '}
          <Link href={`/auth/registro?redirect=${redirect}`} className="text-brand-600 font-medium hover:underline">
            Registrate gratis
          </Link>
        </p>
      </div>
      )}
    </div>
  );
}
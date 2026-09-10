'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, Chrome } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router   = useRouter();
  const params   = useSearchParams();
  const redirect = params.get('redirect') ?? '/';
  const supabase = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

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
    setLoading(true);
    // ✅ FIX: antes llamaba a supabase.auth.signInWithPassword() directo
    // desde acá — imposible ponerle un límite de intentos propio. Ahora
    // pasa por /api/auth/login, que aplica el freno antes de reenviar
    // a Supabase (10 intentos / 15 min por IP).
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(
        res.status === 429
          ? 'Demasiados intentos — esperá unos minutos antes de volver a intentar.'
          : json.error ?? 'Error al iniciar sesión. Intentá de nuevo.'
      );
    } else {
      toast.success('¡Bienvenido!');
      router.push(redirect);
      router.refresh();
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
    });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 animate-scale-in">
        <h1 className="font-display text-2xl font-bold text-center mb-1">Ingresar</h1>
        <p className="text-center text-sm text-muted mb-8">Accedé a tu cuenta para continuar</p>

        {/* Google */}
        <button onClick={handleGoogle} className="btn-secondary w-full mb-4 gap-3">
          <Chrome size={18} className="text-red-500" />
          Continuar con Google
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

          <button type="submit" disabled={loading} className="btn-primary w-full">
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
    </div>
  );
}
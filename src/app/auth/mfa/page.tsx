'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { safeRedirectPath } from '@/lib/safeRedirect';

/**
 * Se llega acá desde el middleware/admin layout cuando la sesión ya pasó el
 * login (email+contraseña) pero todavía no pasó el segundo factor (aal1 →
 * necesita aal2). No es una pantalla de login nueva — el usuario ya está
 * autenticado, solo falta este paso.
 */
// Evita que una promesa del SDK que se cuelga deje el botón en "Verificando…"
// para siempre: a los `ms` falla con un error y se puede reintentar.
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export default function MfaChallengePage() {
  const router   = useRouter();
  const params   = useSearchParams();
  const redirect = safeRedirectPath(params.get('redirect'), '/admin');
  const supabase = createClient();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [ready,    setReady]    = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) {
        toast.error('No se pudo cargar la verificación en dos pasos.');
        return;
      }
      const totp = data.totp.find((f) => f.status === 'verified');
      if (!totp) {
        // No debería pasar (el middleware solo manda acá si hay un factor
        // verificado exigiendo aal2), pero por las dudas no se deja a nadie
        // trabado en una pantalla sin salida.
        router.replace(redirect);
        return;
      }
      setFactorId(totp.id);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6 || loading) return;
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } =
        await withTimeout(supabase.auth.mfa.challenge({ factorId }), 15_000);
      if (challengeError || !challenge) {
        toast.error('Error al iniciar la verificación. Probá de nuevo.');
        setLoading(false);
        return;
      }
      const { error: verifyError } = await withTimeout(
        supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code }),
        15_000
      );
      if (verifyError) {
        toast.error('Código incorrecto. Revisá tu app de autenticación.');
        setCode('');
        setLoading(false);
        return;
      }
      // ✅ FIX (se quedaba en "Verificando…" y no continuaba): antes se hacía
      // router.replace(redirect) + router.refresh() y `loading` nunca volvía
      // a false en el camino de éxito. Si el servidor seguía viendo la
      // sesión anterior (aal1) —por la caché del router de Next, que puede
      // reutilizar la redirección a /auth/mfa hecha antes de verificar— la
      // navegación volvía a caer en esta misma página, React conservaba el
      // estado y quedaba el botón trabado. Ahora, con el segundo factor ya
      // verificado y las cookies actualizadas, se hace una carga completa
      // (igual que el login): el servidor lee las cookies nuevas sin
      // depender de ninguna caché del lado del cliente.
      window.location.assign(redirect);
    } catch {
      toast.error('La verificación tardó demasiado. Probá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-8 animate-scale-in text-center">
        <ShieldCheck size={36} className="mx-auto mb-3 text-brand-500" />
        <h1 className="font-display text-xl font-bold mb-1">Verificación en dos pasos</h1>
        <p className="text-sm text-muted mb-6">
          Ingresá el código de 6 dígitos de tu app de autenticación.
        </p>

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="input-base text-center text-2xl tracking-[0.5em] font-mono"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="btn-primary w-full"
            >
              {loading ? 'Verificando…' : 'Verificar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
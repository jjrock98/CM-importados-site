'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Se llega acá desde el middleware/admin layout cuando la sesión ya pasó el
 * login (email+contraseña) pero todavía no pasó el segundo factor (aal1 →
 * necesita aal2). No es una pantalla de login nueva — el usuario ya está
 * autenticado, solo falta este paso.
 */
export default function MfaChallengePage() {
  const router   = useRouter();
  const params   = useSearchParams();
  const redirect = params.get('redirect') ?? '/admin';
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
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      toast.error('Error al iniciar la verificación. Probá de nuevo.');
      setLoading(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      toast.error('Código incorrecto. Revisá tu app de autenticación.');
      setCode('');
      setLoading(false);
      return;
    }
    router.replace(redirect);
    router.refresh();
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
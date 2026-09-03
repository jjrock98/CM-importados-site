'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function VerificarPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const check = async () => {
      // Supabase handles the token in the URL hash automatically
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email_confirmed_at) {
        setStatus('success');
        // Redirect to home after 3 seconds
        setTimeout(() => router.push('/'), 3000);
      } else {
        // Wait a moment for Supabase to process the token
        await new Promise((r) => setTimeout(r, 2000));
        const { data: { user: refreshed } } = await supabase.auth.getUser();
        if (refreshed?.email_confirmed_at) {
          setStatus('success');
          setTimeout(() => router.push('/'), 3000);
        } else {
          setStatus('error');
        }
      }
    };
    check();
  }, []);

  if (status === 'loading') return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 size={40} className="animate-spin text-brand-500" />
      <p className="text-muted">Verificando tu cuenta…</p>
    </div>
  );

  if (status === 'success') return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center px-4">
      <div className="rounded-full bg-green-50 dark:bg-green-950/20 p-6">
        <CheckCircle2 size={56} className="text-green-500" />
      </div>
      <h1 className="font-display text-2xl font-bold">¡Cuenta verificada!</h1>
      <p className="text-muted max-w-sm">Tu email fue confirmado exitosamente. Redirigiendo al inicio…</p>
      <Link href="/" className="btn-primary">Ir al inicio ahora</Link>
    </div>
  );

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center px-4">
      <div className="rounded-full bg-red-50 dark:bg-red-950/20 p-6">
        <XCircle size={56} className="text-red-500" />
      </div>
      <h1 className="font-display text-2xl font-bold">Link inválido o expirado</h1>
      <p className="text-muted max-w-sm">
        El link de verificación expiró o ya fue usado. Podés solicitar uno nuevo desde tu cuenta.
      </p>
      <div className="flex gap-3">
        <Link href="/auth/login" className="btn-primary">Iniciar sesión</Link>
        <Link href="/" className="btn-secondary">Ir al inicio</Link>
      </div>
    </div>
  );
}

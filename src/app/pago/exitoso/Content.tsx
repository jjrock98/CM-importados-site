'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export function PagoExitosoContent() {
  const params  = useSearchParams();
  const orderId = params.get('orderId') ?? params.get('external_reference');
  const [count, setCount] = useState(3);

  useEffect(() => {
    const dest = '/mis-pedidos';
    const iv = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(iv);
          if (window.opener && !window.opener.closed) {
            try { window.opener.location.href = dest; window.close(); }
            catch { window.location.href = dest; }
          } else { window.location.href = dest; }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const goNow = () => {
    if (window.opener && !window.opener.closed) {
      try { window.opener.location.href = '/mis-pedidos'; window.close(); }
      catch { window.location.href = '/mis-pedidos'; }
    } else { window.location.href = '/mis-pedidos'; }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center bg-surface">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-green-400 opacity-20 animate-ping" />
        <div className="relative rounded-full bg-green-50 dark:bg-green-950/30 p-6">
          <CheckCircle2 size={64} className="text-green-500" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-green-700 dark:text-green-400">¡Pago aprobado!</h1>
        <p className="text-muted max-w-sm">Tu pago fue procesado con éxito. Recibirás un email de confirmación.</p>
        {orderId && <p className="text-sm font-mono text-muted">Pedido: <strong>#{orderId.slice(0,8).toUpperCase()}</strong></p>}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="relative h-16 w-16">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-surface-2" strokeWidth="4" />
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-green-500 transition-all duration-1000"
              strokeWidth="4" strokeDasharray="175.9" strokeDashoffset={175.9 * (1 - count / 3)} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-bold text-xl">{count}</span>
        </div>
        <p className="text-xs text-muted">Redirigiendo en {count}s…</p>
      </div>
      <button onClick={goNow} className="btn-primary min-w-48">Ver mis pedidos →</button>
      <Link href="/" className="text-sm text-muted hover:text-foreground">Volver al inicio</Link>
    </div>
  );
}

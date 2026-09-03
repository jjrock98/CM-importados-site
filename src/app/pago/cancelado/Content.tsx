'use client';
import { ArrowLeft, ShoppingCart } from 'lucide-react';

export function PagoCanceladoContent() {
  const go = (dest: string) => {
    if (window.opener && !window.opener.closed) {
      try { window.opener.location.href = dest; window.close(); }
      catch { window.location.href = dest; }
    } else { window.location.href = dest; }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center bg-surface">
      <div className="rounded-full bg-gray-100 dark:bg-zinc-800 p-6">
        <span className="text-6xl">↩️</span>
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">Pago cancelado</h1>
        <p className="text-muted max-w-sm">Cancelaste el proceso. Tu pedido no fue confirmado. Podés volver a intentarlo cuando quieras.</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => go('/checkout')} className="btn-primary gap-2">
          <ShoppingCart size={15} /> Volver al checkout
        </button>
        <button onClick={() => go('/')} className="btn-secondary gap-2">
          <ArrowLeft size={15} /> Ir al inicio
        </button>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock, Banknote, Info } from 'lucide-react';

export function PagoPendienteContent() {
  const params      = useSearchParams();
  const orderId     = params.get('orderId') ?? params.get('external_reference');
  const paymentType = params.get('payment_type');
  const isCash      = paymentType === 'ticket' || paymentType === 'atm';
  const [count, setCount] = useState(5);

  useEffect(() => {
    const iv = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(iv);
          if (window.opener && !window.opener.closed) {
            try { window.opener.location.href = '/mis-pedidos'; window.close(); }
            catch { window.location.href = '/mis-pedidos'; }
          } else { window.location.href = '/mis-pedidos'; }
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
      <div className="rounded-full bg-yellow-50 dark:bg-yellow-950/30 p-6">
        {isCash ? <Banknote size={64} className="text-yellow-500" /> : <Clock size={64} className="text-yellow-500" />}
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-yellow-700 dark:text-yellow-400">Pago pendiente</h1>
        <p className="text-muted max-w-sm">
          {isCash
            ? 'Tu pedido está reservado. Pagá en efectivo en el punto indicado por Mercado Pago.'
            : 'Tu pago está siendo procesado. Puede demorar hasta 24 horas hábiles.'}
        </p>
        {orderId && <p className="text-sm font-mono text-muted">Pedido: <strong>#{orderId.slice(0,8).toUpperCase()}</strong></p>}
      </div>
      {isCash && (
        <div className="card border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 p-4 max-w-sm text-sm text-left space-y-2">
          <p className="font-semibold flex items-center gap-2 text-yellow-800 dark:text-yellow-400"><Info size={14} /> Instrucciones de pago en efectivo</p>
          <ul className="text-yellow-700 dark:text-yellow-400 space-y-1 text-xs list-disc list-inside">
            <li>Mercado Pago te envió las instrucciones al email.</li>
            <li>Podés pagar en Rapipago, Pago Fácil u otros puntos.</li>
            <li>El pedido se confirma automáticamente al acreditarse.</li>
            <li>Reserva válida por 3 días hábiles.</li>
          </ul>
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-yellow-400 font-bold text-lg text-yellow-600">{count}</div>
        <p className="text-xs text-muted">Redirigiendo en {count}s…</p>
      </div>
      <button onClick={goNow} className="btn-primary min-w-48">Ver mis pedidos →</button>
    </div>
  );
}

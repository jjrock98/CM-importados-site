'use client';
import { useSearchParams } from 'next/navigation';
import { XCircle, RefreshCw, ArrowLeft } from 'lucide-react';

const REJECTION_REASONS: Record<string, string> = {
  cc_rejected_bad_filled_card_number:   'Número de tarjeta incorrecto.',
  cc_rejected_bad_filled_date:          'Fecha de vencimiento incorrecta.',
  cc_rejected_bad_filled_other:         'Datos de tarjeta incorrectos.',
  cc_rejected_bad_filled_security_code: 'Código de seguridad incorrecto.',
  cc_rejected_blacklist:                'La tarjeta fue rechazada.',
  cc_rejected_call_for_authorize:       'Debés autorizar el pago con tu banco.',
  cc_rejected_card_disabled:            'La tarjeta está deshabilitada. Contactá a tu banco.',
  cc_rejected_high_risk:                'Pago rechazado por seguridad. Intentá con otro medio.',
  cc_rejected_insufficient_amount:      'Fondos insuficientes.',
  cc_rejected_max_attempts:             'Superaste el límite de intentos. Probá otra tarjeta.',
};

export function PagoErrorContent() {
  const params  = useSearchParams();
  const orderId = params.get('orderId') ?? params.get('external_reference');
  const reason  = params.get('status_detail') ?? '';
  const msg     = REJECTION_REASONS[reason] ?? 'El pago no pudo procesarse. Podés intentar con otro método.';

  const go = (dest: string) => {
    if (window.opener && !window.opener.closed) {
      try { window.opener.location.href = dest; window.close(); }
      catch { window.location.href = dest; }
    } else { window.location.href = dest; }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center bg-surface">
      <div className="rounded-full bg-red-50 dark:bg-red-950/30 p-6">
        <XCircle size={64} className="text-red-500" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-red-700 dark:text-red-400">Pago rechazado</h1>
        <p className="text-muted max-w-sm">{msg}</p>
        {reason && <p className="text-xs font-mono text-muted/60">Código: {reason}</p>}
      </div>
      <div className="card p-4 max-w-sm text-sm text-left bg-surface-2 space-y-2">
        <p className="font-medium">¿Qué podés hacer?</p>
        <ul className="text-muted text-xs list-disc list-inside space-y-1">
          <li>Verificar los datos de tu tarjeta.</li>
          <li>Intentar con otra tarjeta o dinero en cuenta.</li>
          <li>Contactar a tu banco para autorizar el pago.</li>
          <li>Pagar en efectivo (Rapipago / Pago Fácil).</li>
        </ul>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => go('/checkout')} className="btn-primary gap-2">
          <RefreshCw size={15} /> Intentar de nuevo
        </button>
        <button onClick={() => go('/')} className="btn-secondary gap-2">
          <ArrowLeft size={15} /> Volver a la tienda
        </button>
      </div>
      {orderId && (
        <p className="text-xs text-muted">ID de pedido: <span className="font-mono font-bold">#{orderId.slice(0,8).toUpperCase()}</span></p>
      )}
    </div>
  );
}

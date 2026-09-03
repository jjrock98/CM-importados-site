import { Suspense } from 'react';
import { PagoErrorContent } from '@/app/pago/error/Content';

export const metadata = { title: 'Pago rechazado' };

/**
 * Alias de /pago/error. Mercado Pago redirige acá según
 * la back_url 'failure' configurada en la preferencia.
 */
export default function CheckoutFailurePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-red-400 border-t-transparent" /></div>}>
      <PagoErrorContent />
    </Suspense>
  );
}

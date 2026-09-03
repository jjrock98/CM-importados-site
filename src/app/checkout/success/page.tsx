import { Suspense } from 'react';
import { PagoExitosoContent } from '@/app/pago/exitoso/Content';

export const metadata = { title: 'Pago aprobado' };

/**
 * Alias de /pago/exitoso. Mercado Pago redirige acá según
 * la back_url 'success' configurada en la preferencia.
 * Reutiliza el mismo componente (countdown + cierre de popup).
 */
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-400 border-t-transparent" /></div>}>
      <PagoExitosoContent />
    </Suspense>
  );
}

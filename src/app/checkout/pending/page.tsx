import { Suspense } from 'react';
import { PendingContent } from './Content';

export const metadata = { title: 'Pedido reservado — Pago pendiente' };

export default function CheckoutPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      }
    >
      <PendingContent />
    </Suspense>
  );
}

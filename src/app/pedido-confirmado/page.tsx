import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PedidoConfirmadoContent } from './Content';

export const metadata: Metadata = {
  title: 'Pedido confirmado',
  robots: { index: false },
};

export default function PedidoConfirmadoPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
      </div>
    }>
      <PedidoConfirmadoContent />
    </Suspense>
  );
}

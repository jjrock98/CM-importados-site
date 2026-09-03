import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SeguimientoContent } from './Content';

export const metadata: Metadata = {
  title: 'Seguimiento de pedido',
  robots: { index: false },
};

export default function SeguimientoPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
      </div>
    }>
      <SeguimientoContent />
    </Suspense>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-display text-8xl font-black text-brand-200 dark:text-brand-900 select-none">
        404
      </p>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Página no encontrada</h1>
        <p className="text-muted max-w-sm">
          La página que buscás no existe o fue movida a otra dirección.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/" className="btn-primary">
          Volver al inicio
        </Link>
        <Link href="/contacto" className="btn-secondary">
          Contactarnos
        </Link>
      </div>
    </div>
  );
}

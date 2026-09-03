'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  error:  Error & { digest?: string };
  reset:  () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Log to error monitoring service in production
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 p-5">
        <AlertTriangle size={40} className="text-red-500 mx-auto" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="text-zinc-500 max-w-sm text-sm">
          Ocurrió un error inesperado. Podés intentar recargar la página o volver al inicio.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 px-3 py-2 font-mono text-xs text-red-600 dark:text-red-400">
            {error.message}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={15} /> Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
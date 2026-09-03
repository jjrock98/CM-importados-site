import { Suspense } from 'react';
import { PagoPendienteContent } from './Content';
export default function PagoPendientePage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" /></div>}><PagoPendienteContent /></Suspense>;
}

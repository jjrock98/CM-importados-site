import { Suspense } from 'react';
import { PagoErrorContent } from './Content';
export default function PagoErrorPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-red-400 border-t-transparent" /></div>}><PagoErrorContent /></Suspense>;
}

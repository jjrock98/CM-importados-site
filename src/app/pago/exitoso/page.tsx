import { Suspense } from 'react';
import { PagoExitosoContent } from './Content';

export default function PagoExitosoPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>}><PagoExitosoContent /></Suspense>;
}

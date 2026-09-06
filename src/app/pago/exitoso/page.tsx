import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PagoExitosoContent } from './Content';

export const metadata: Metadata = { robots: { index: false } };

export default function PagoExitosoPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>}><PagoExitosoContent /></Suspense>;
}
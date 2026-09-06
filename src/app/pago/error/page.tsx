import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PagoErrorContent } from './Content';
export const metadata: Metadata = { robots: { index: false } };
export default function PagoErrorPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-red-400 border-t-transparent" /></div>}><PagoErrorContent /></Suspense>;
}
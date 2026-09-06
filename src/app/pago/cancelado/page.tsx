import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PagoCanceladoContent } from './Content';
export const metadata: Metadata = { robots: { index: false } };
export default function PagoCanceladoPage() {
  return <Suspense fallback={null}><PagoCanceladoContent /></Suspense>;
}
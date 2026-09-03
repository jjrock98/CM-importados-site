import { Suspense } from 'react';
import { PagoCanceladoContent } from './Content';
export default function PagoCanceladoPage() {
  return <Suspense fallback={null}><PagoCanceladoContent /></Suspense>;
}

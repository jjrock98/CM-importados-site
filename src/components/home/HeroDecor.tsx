'use client';

import dynamic from 'next/dynamic';

// ✅ FIX perf (LCP / JS de arranque): HeroSmoke y HeroVisual son 100%
// decorativos (aria-hidden, no aportan contenido ni SEO) pero antes se
// importaban de forma estática en page.tsx (Server Component), así que
// su JS (framer-motion + el cálculo de ruido del canvas) se ejecutaba
// de entrada, compitiendo por CPU con la hidratación de la página y
// empujando el LCP.
//
// `ssr: false` en next/dynamic no está permitido dentro de un Server
// Component — por eso este wrapper vive en su propio Client Component:
// así el humo y los blobs animados se cargan y ejecutan recién después
// de la hidratación, en un chunk aparte, sin bloquear el pintado inicial
// del hero (texto, H1, botones).
const HeroSmoke = dynamic(
  () => import('./HeroSmoke').then((m) => m.HeroSmoke),
  { ssr: false }
);

const HeroVisual = dynamic(
  () => import('./HeroVisual').then((m) => m.HeroVisual),
  { ssr: false }
);

export function HeroDecor({ hideBackgroundEffects = false }: { hideBackgroundEffects?: boolean }) {
  return (
    <>
      <HeroSmoke />
      <HeroVisual hideBackgroundEffects={hideBackgroundEffects} />
    </>
  );
}
'use client';
import { LazyMotion, domAnimation } from 'framer-motion';
import type { ReactNode } from 'react';

// ✅ PERF: sin esto, cada componente que usaba <motion.*> (AnimateIn,
// PageHero, HeroVisual, MinoristaGrid) importaba el objeto `motion`
// completo — eso empaqueta TODO el motor de Framer Motion (gestos, drag,
// animaciones de layout compartido, etc.), aunque en este sitio solo se
// usan fades/slides/scale simples con whileInView. `domAnimation` es el
// subconjunto chico que cubre exactamente eso (no incluye drag ni layout
// animations, que no se usan en ningún lado del proyecto — se confirmó
// por grep antes de este cambio). LazyMotion + el componente `m.*` (en vez
// de `motion.*`) es el patrón que la propia documentación de Framer
// Motion recomienda para este caso. `strict` hace que tire un error en
// desarrollo si en algún lado se usa `motion.*` en vez de `m.*` sin querer
// — así este ahorro no se rompe en silencio en un cambio futuro.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
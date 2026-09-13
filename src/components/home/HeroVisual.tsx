'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Fondo animado del hero. Todo lo que dibuja está atado a contenido real del
 * negocio (talles, colores, el sello de "docena cerrada") en vez de ser
 * decoración abstracta genérica.
 *
 * `useReducedMotion` respeta prefers-reduced-motion: si el usuario lo pidió,
 * los blobs y chips quedan estáticos (sin loop infinito).
 */

const TAGS = [
  { label: 'Novedad',   top: '16%', left: '6%',  delay: 0,   tilt: -6 },
  { label: 'Variedad',          top: '68%', left: '9%',  delay: 1.2, tilt: 5  },
  { label: 'Colores y talles surtidos', top: '74%', left: '80%', delay: 0.6, tilt: -4 },
];

const DOTS = ['#c9974b', '#8ba1c9', '#e5e7eb', '#3d5588'];

export function HeroVisual({ hideBackgroundEffects = false }: { hideBackgroundEffects?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {!hideBackgroundEffects && (
        <>
          {/* Blobs de gradiente — profundidad de fondo, en vez del punteado estático fijo */}
          <motion.div
            className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl"
            animate={reduce ? undefined : { transform: ['translate(0,0) scale(1)', 'translate(4%,6%) scale(1.08)', 'translate(-3%,-4%) scale(0.96)', 'translate(0,0) scale(1)'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-32 -right-10 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl"
            animate={reduce ? undefined : { transform: ['translate(0,0) scale(1)', 'translate(-4%,-5%) scale(1.06)', 'translate(3%,4%) scale(0.94)', 'translate(0,0) scale(1)'] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />

          {/* Grilla de puntos sutil, sobre los blobs */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        </>
      )}

      {/* Chips flotantes: talles y colores reales del catálogo, no íconos random */}
      {TAGS.map((tag, i) => (
        <motion.div
          key={tag.label}
          className="absolute hidden select-none items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm md:flex"
          style={{ top: tag.top, left: tag.left, ['--tilt' as string]: `${tag.tilt}deg` }}
          initial={{ opacity: 0, y: 10 }}
          animate={
            reduce
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: [0, -16, 0], rotate: tag.tilt }
          }
          transition={
            reduce
              ? { duration: 0.5, delay: 0.3 + tag.delay }
              : { opacity: { duration: 0.5, delay: 0.3 + tag.delay }, y: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: tag.delay } }
          }
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: DOTS[i % DOTS.length] }} />
          {tag.label}
        </motion.div>
      ))}

      {/* Sello "Docena cerrada" — el elemento firma: reproduce un sello de
          embalaje/control de calidad, con animación de "estampado" al
          cargar la página. */}
      <motion.div
        className="absolute right-6 top-6 hidden md:block lg:right-10 lg:top-10"
        initial={{ opacity: 0, scale: 1.6, rotate: -18 }}
        animate={{ opacity: 1, scale: 1, rotate: -12 }}
        transition={{ duration: 0.5, delay: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-dashed border-accent-300/70 text-center lg:h-28 lg:w-28">
          <Check size={18} className="text-accent-300" strokeWidth={3} />
          <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-accent-100 leading-tight">
            Docena
            <br />
            cerrada
          </span>
        </div>
      </motion.div>
    </div>
  );
}
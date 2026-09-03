'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface PageHeroProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Pasar el ícono YA renderizado, ej. `icon={<MapPin size={28} />}`.
   *  Nunca pasar el componente sin renderizar (`icon={MapPin}`): al venir
   *  de un Server Component, una referencia a función no es serializable
   *  y rompe el boundary server→client. */
  icon?: ReactNode;
}

/**
 * Header navy reutilizable para páginas internas (FAQ, Contacto, Ubicación,
 * Términos, Políticas). Es una versión compacta del hero de la home: mismo
 * fondo navy, mismo divisor angular, mismo tipo de entrada escalonada — así
 * el sitio se siente como un mismo sistema en vez de una home animada y
 * páginas internas estáticas sueltas.
 */
export function PageHero({ eyebrow, title, description, icon }: PageHeroProps) {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-brand-800 text-white">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <motion.div
        className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-accent-500/15 blur-3xl"
        aria-hidden="true"
        animate={reduce ? undefined : { transform: ['translate(0,0) scale(1)', 'translate(-4%,5%) scale(1.08)', 'translate(0,0) scale(1)'] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:py-16">
        {eyebrow && (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/70"
          >
            {eyebrow}
          </motion.span>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="mt-4 flex items-center justify-center gap-3 font-display text-3xl font-bold tracking-tight md:text-4xl"
        >
          {icon && <span className="text-accent-300 [&>svg]:h-7 [&>svg]:w-7">{icon}</span>}
          {title}
        </motion.h1>

        {description && (
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
            className="mx-auto mt-3 max-w-xl text-white/75"
          >
            {description}
          </motion.p>
        )}
      </div>

      <svg className="relative block w-full text-surface" viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ height: '26px' }} aria-hidden="true">
        <path d="M0 40L1440 0V40H0Z" fill="currentColor" />
      </svg>
    </section>
  );
}

'use client';

import { m, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/utils';

interface PageHeroProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Pasar el ícono YA renderizado, ej. `icon={<MapPin size={28} />}`.
   *  Nunca pasar el componente sin renderizar (`icon={MapPin}`): al venir
   *  de un Server Component, una referencia a función no es serializable
   *  y rompe el boundary server→client. */
  icon?: ReactNode;
  /** Versión baja para páginas donde el contenido importa más que el título
   *  (ej. el catálogo): menos alto, sin etiqueta superior y, en celular, sin
   *  descripción — para que los productos queden a la vista sin hacer scroll. */
  compact?: boolean;
}

/**
 * Header navy reutilizable para páginas internas (FAQ, Contacto, Ubicación,
 * Términos, Políticas). Es una versión compacta del hero de la home: mismo
 * fondo navy, mismo divisor angular, mismo tipo de entrada escalonada — así
 * el sitio se siente como un mismo sistema en vez de una home animada y
 * páginas internas estáticas sueltas.
 */
export function PageHero({ eyebrow, title, description, icon, compact = false }: PageHeroProps) {
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
      <m.div
        className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-accent-500/15 blur-3xl"
        aria-hidden="true"
        animate={reduce ? undefined : { transform: ['translate(0,0) scale(1)', 'translate(-4%,5%) scale(1.08)', 'translate(0,0) scale(1)'] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className={cn('relative mx-auto max-w-5xl px-4 text-center', compact ? 'py-5 sm:py-7' : 'py-14 sm:py-16')}>
        {eyebrow && !compact && (
          <m.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/70"
          >
            {eyebrow}
          </m.span>
        )}

        <m.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className={cn('flex items-center justify-center gap-3 font-display font-bold tracking-tight', compact ? 'text-2xl md:text-3xl' : 'mt-4 text-3xl md:text-4xl')}
        >
          {icon && <span className="text-accent-300 [&>svg]:h-7 [&>svg]:w-7">{icon}</span>}
          {title}
        </m.h1>

        {description && (
          <m.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
            className={cn('mx-auto max-w-xl text-white/75', compact ? 'mt-1 hidden text-sm sm:block' : 'mt-3')}
          >
            {description}
          </m.p>
        )}
      </div>

      <svg className="relative block w-full text-surface" viewBox="0 0 1440 40" preserveAspectRatio="none" style={{ height: '26px' }} aria-hidden="true">
        <path d="M0 40L1440 0V40H0Z" fill="currentColor" />
      </svg>
    </section>
  );
}
'use client';
import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

// ── Variantes de animación reutilizables ──────────────────────────────────────

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
};

export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

/** Stagger container: anima los hijos uno por uno */
export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// ── Componentes listos para usar ──────────────────────────────────────────────

interface AnimateInProps {
  children:  ReactNode;
  className?: string;
  delay?:     number;
  variant?:   Variants;
  once?:      boolean;
}

/** Wrapper genérico: anima cuando el elemento entra al viewport */
export function AnimateIn({
  children,
  className,
  delay    = 0,
  variant  = fadeUp,
  once     = true,
}: AnimateInProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.15 }}
      variants={variant}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/** Grid con stagger — anima los hijos en cascada */
export function StaggerGrid({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

/** Item individual para usar dentro de StaggerGrid */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/** Animación de página completa (fade al entrar) */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Para modales y drawers — escala desde el centro */
export function ModalTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Para listas de items — fade + slide al entrar */
export function ListItem({ children, className, index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Efecto de humo/niebla para el hero — 100% CSS, sin ningún archivo que
 * descargar (ni video ni imagen). Son capas de gradientes radiales muy
 * difuminados, en blanco/gris, con `mix-blend-mode: screen` (aclara sobre
 * el fondo oscuro en vez de taparlo, igual que la luz real atravesando
 * humo) y animadas lentamente con transform (translate + scale + rotate)
 * para que se sientan orgánicas en vez de mecánicas.
 *
 * Por qué esto y no un video de humo:
 *   - Cero peso de red: no hay archivo de video/imagen que bajar, así que
 *     nunca puede "tardar" ni consumir datos del que entra desde el
 *     celular — es la opción más liviana posible, más liviana incluso
 *     que la mejor compresión de un video real.
 *   - `transform` es la única propiedad que anima acá — el navegador la
 *     compone en la GPU sin recalcular layout/paint en cada frame, que es
 *     lo que hace que una animación CSS se sienta fluida en vez de trabada.
 *   - Respeta `prefers-reduced-motion`: si el usuario lo pidió, las capas
 *     quedan quietas en su posición inicial (mismo patrón que HeroVisual).
 */
export function HeroSmoke() {
  const reduce = useReducedMotion();

  const wisps = [
    { top: '-10%', left: '-15%', size: 'h-[60%] w-[70%]', duration: 26, delay: 0 },
    { top: '30%',  left: '55%',  size: 'h-[70%] w-[80%]', duration: 32, delay: -8 },
    { top: '-5%',  left: '40%',  size: 'h-[55%] w-[65%]', duration: 22, delay: -14 },
    { top: '45%',  left: '-10%', size: 'h-[65%] w-[75%]', duration: 30, delay: -4 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {wisps.map((w, i) => (
        <motion.div
          key={i}
          className={`absolute ${w.size} rounded-full opacity-[0.55] blur-2xl`}
          style={{
            top: w.top,
            left: w.left,
            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.6) 35%, rgba(255,255,255,0.15) 60%, transparent 75%)',
            mixBlendMode: 'screen',
          }}
          animate={
            reduce
              ? undefined
              : {
                  transform: [
                    'translate(0%, 0%) scale(1) rotate(0deg)',
                    'translate(6%, -4%) scale(1.15) rotate(8deg)',
                    'translate(-4%, 5%) scale(0.9) rotate(-6deg)',
                    'translate(3%, 3%) scale(1.05) rotate(4deg)',
                    'translate(0%, 0%) scale(1) rotate(0deg)',
                  ],
                }
          }
          transition={{ duration: w.duration, delay: w.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
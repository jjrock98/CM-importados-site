'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Efecto de humo del hero — v2: ruido animado en <canvas>, en vez de
 * manchas de gradiente CSS (la v1 que reemplaza este archivo).
 *
 * Por qué esto se ve más parecido a un humo real:
 *   - Antes: 4 círculos difuminados con `blur-2xl` moviéndose lento →
 *     "manchas de luz", sin textura interna.
 *   - Ahora: un campo de ruido tipo Perlin (con 4 octavas, o sea "fractal
 *     brownian motion") que genera volutas con espacio entre ellas,
 *     detalle fino y una deriva continua hacia arriba — igual que el
 *     humo real sube y se retuerce, en vez de solo "respirar" en el
 *     lugar.
 *
 * Por qué sigue sin pesar nada de red (mismo espíritu que la v1):
 *   - Cero archivos: el ruido se calcula en JS, no hay imagen ni video
 *     que descargar.
 *   - El ruido se calcula en una grilla CHICA (96×40 celdas) y esa
 *     grilla se estira al tamaño real de pantalla con suavizado del
 *     propio canvas — muchísimo más barato que calcular ruido por cada
 *     píxel real, y el estirado con blur es justamente lo que le da esa
 *     textura difusa de humo.
 *   - Se pausa solo cuando la pestaña está oculta o cuando el hero se
 *     scrollea fuera de pantalla (IntersectionObserver) — no gasta CPU
 *     de más si nadie lo está viendo.
 *   - Respeta `prefers-reduced-motion`: dibuja un único frame fijo, sin
 *     loop, si el usuario lo pidió.
 */

// ── Ruido de valor con permutación (técnica clásica de Ken Perlin,
// dominio público) — autocontenido, sin ninguna dependencia nueva. ──────
function createNoise2D(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number) => {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  };

  return function noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[X + perm[Y]];
    const ab = perm[X + perm[Y + 1]];
    const ba = perm[X + 1 + perm[Y]];
    const bb = perm[X + 1 + perm[Y + 1]];
    return lerp(
      lerp(grad(aa, xf, yf),     grad(ba, xf - 1, yf),     u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

// Fractal Brownian Motion: suma varias "octavas" del mismo ruido a
// distinta frecuencia/amplitud — es lo que le da el detalle fino de
// volutas dentro de las formas grandes, en vez de manchas lisas.
function fbm(noise2D: (x: number, y: number) => number, x: number, y: number, octaves: number): number {
  let total = 0, amplitude = 0.5, frequency = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, y * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / max; // ~[-1, 1]
}

const GRID_W = 96;
const GRID_H = 40;
const NOISE_SCALE = 0.09;   // qué tan "zoomeado" se ve el patrón
const DRIFT_X     = 0.05;   // deriva horizontal
const DRIFT_Y     = -0.11;  // deriva vertical negativa = el humo "sube"
const TIME_SPEED  = 0.00028; // velocidad de evolución del patrón

export function HeroSmoke() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const noise2D = createNoise2D(1337);

    // Canvas chico "de trabajo" donde se calcula el ruido — ver comentario
    // de arriba sobre por qué no se calcula a resolución real de pantalla.
    const work = document.createElement('canvas');
    work.width = GRID_W;
    work.height = GRID_H;
    const workCtx = work.getContext('2d');
    if (!workCtx) return;
    const imageData = workCtx.createImageData(GRID_W, GRID_H);
    const data = imageData.data;

    let rafId = 0;
    let isVisible = true;
    let isTabVisible = !document.hidden;

    function resizeCanvasBitmap() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width  = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
    }

    function drawFrame(t: number) {
      const time = t * TIME_SPEED;
      let k = 0;
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const nx = x * NOISE_SCALE + time * DRIFT_X;
          const ny = y * NOISE_SCALE + time * DRIFT_Y;
          const n = fbm(noise2D, nx, ny, 4);
          // Se corre el umbral hacia arriba para que haya más "aire" que
          // "humo" — si no, queda una sopa blanca pareja en vez de
          // volutas con huecos entre ellas.
          const alpha = Math.max(0, Math.min(1, (n - 0.05) * 1.6));
          data[k++] = 255;
          data[k++] = 255;
          data[k++] = 255;
          data[k++] = Math.round(alpha * 255);
        }
      }
      workCtx!.putImageData(imageData, 0, 0);

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.imageSmoothingEnabled = true;
      ctx!.drawImage(work, 0, 0, canvas!.width, canvas!.height);
    }

    resizeCanvasBitmap();
    if (reduce) {
      drawFrame(0);
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvasBitmap();
      if (reduce) drawFrame(0);
    });
    resizeObserver.observe(canvas.parentElement ?? canvas);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting; },
      { threshold: 0 }
    );
    intersectionObserver.observe(canvas);

    const onVisibilityChange = () => { isTabVisible = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (!reduce) {
      const loop = (t: number) => {
        if (isVisible && isTabVisible) drawFrame(t);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 opacity-80 blur-md"
      style={{ mixBlendMode: 'screen' }}
      aria-hidden="true"
    />
  );
}
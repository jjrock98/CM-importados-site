import { timingSafeEqual } from 'crypto';

/**
 * Compara dos strings "secretos" en tiempo constante, para que un
 * atacante no pueda usar la diferencia de latencia entre intentos como
 * pista de cuántos caracteres acertó (timing attack).
 *
 * Mismo patrón que ya se usa para la firma de Mercado Pago
 * (ver src/app/api/webhooks/mercadopago/route.ts) — acá se reutiliza
 * para las rutas protegidas por REVALIDATE_SECRET_TOKEN (revalidate,
 * los crons, y el secreto interno de send-notification), que antes
 * comparaban con `===` normal.
 *
 * Devuelve false ante cualquier input inválido (null, undefined, tipos
 * raros) en vez de tirar una excepción — así cada ruta puede seguir
 * escribiendo `if (!secretsMatch(a, b)) return 401` sin chequeos extra.
 */
export function secretsMatch(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected) return false;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  // timingSafeEqual exige buffers del mismo largo — si difieren, ya
  // sabemos que no matchean, pero igual hay que devolver en un tiempo
  // "parecido" al de una comparación real. Comparar contra un buffer
  // del mismo largo que el propio `expected` (relleno con ceros) logra
  // eso sin filtrar nada útil sobre `received`.
  if (a.length !== b.length) {
    timingSafeEqual(b, b); // gasta un tiempo comparable, resultado ignorado
    return false;
  }

  return timingSafeEqual(a, b);
}
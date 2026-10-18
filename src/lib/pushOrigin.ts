/**
 * Helpers para decidir desde qué "origen" (dominio) se permite registrar
 * notificaciones push del admin.
 *
 * Por qué existe: una suscripción push es POR ORIGEN. Si entrás al panel
 * desde localhost, desde mc-importados.shop y desde la app instalada (PWA)
 * de otro dominio, el mismo navegador queda con 3 suscripciones y cada
 * pedido te llega 3 veces. Solo se permite suscribirse desde el dominio
 * real del sitio (NEXT_PUBLIC_APP_URL).
 */

/** "https://www.sitio.com/ruta" → "https://sitio.com" (sin www, sin ruta). */
export function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, '');
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return null;
  }
}

/**
 * ¿Se puede registrar push desde este origen?
 * - Desarrollo (localhost): no, salvo que se active NEXT_PUBLIC_ENABLE_DEV_PUSH=1.
 * - Producción: solo si coincide con NEXT_PUBLIC_APP_URL (ignorando "www.").
 * - Si NEXT_PUBLIC_APP_URL no está configurada no se puede validar: no bloquea.
 */
export function isPushOriginAllowed(
  currentOrigin: string,
  appUrl: string | undefined,
  isProduction: boolean,
  devOptIn: boolean,
): boolean {
  if (!isProduction) return devOptIn;
  const expected = normalizeOrigin(appUrl);
  if (!expected) return true;
  return normalizeOrigin(currentOrigin) === expected;
}
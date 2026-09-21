/**
 * Valida un destino de redirección que llega por la URL (?redirect=… o
 * ?next=…) y devuelve SOLO una ruta interna del propio sitio.
 *
 * Por qué existe: sin esto, un link armado como
 *   /auth/login?redirect=https://sitio-malo.com
 *   /auth/login?redirect=//sitio-malo.com
 * mandaba a la persona a otro sitio justo después de loguearse
 * (redirección abierta, útil para phishing porque el link empieza con el
 * dominio real de la tienda).
 *
 * Reglas: tiene que empezar con "/", y al resolverse contra el origen del
 * sitio tiene que seguir siendo el mismo origen. Eso descarta URLs
 * absolutas ("https://…"), las de protocolo relativo ("//host"), la
 * variante con barra invertida ("/\host", que los navegadores tratan
 * como "//host") y cualquier truco con caracteres de control.
 * Si no cumple, se usa `fallback`.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = '/'
): string {
  if (!value || !value.startsWith('/')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = 'http://internal.invalid';
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
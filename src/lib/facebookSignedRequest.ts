import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifica y decodifica un `signed_request` de Facebook/Meta.
 *
 * Formato: `{firma_base64url}.{payload_base64url}`
 *   - `payload` es un JSON en base64url con, como mínimo, `user_id`
 *     (el ID de Facebook de la persona) y `algorithm`.
 *   - `firma` es el HMAC-SHA256 del texto del payload (todavía
 *     codificado, SIN decodificar), usando el App Secret de Meta como
 *     clave — así Meta prueba que el mensaje realmente vino de ellos.
 *
 * Devuelve el payload ya parseado si la firma es válida, o `null` si es
 * inválida/está corrupta — el caller SIEMPRE debe tratar `null` como
 * "no confiar en este request".
 */
export function verifyFacebookSignedRequest(
  signedRequest: string,
  appSecret: string
): { user_id: string; algorithm: string; issued_at?: number } | null {
  const parts = signedRequest.split('.');
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;

  let expectedSig: Buffer;
  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(encodedSig, 'base64url');
    expectedSig = createHmac('sha256', appSecret).update(encodedPayload).digest();
  } catch {
    return null;
  }

  // Longitud distinta → timingSafeEqual explota; se corta antes.
  if (actualSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(actualSig, expectedSig)) return null;

  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    if (payload.algorithm !== 'HMAC-SHA256' || typeof payload.user_id !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
/**
 * Verificación server-side de Cloudflare Turnstile.
 *
 * Turnstile es el captcha "invisible" de Cloudflare: gratis, sin límite de
 * uso, y en la gran mayoría de los casos el usuario ni ve un desafío visual
 * (solo un check silencioso en segundo plano). El token que genera el widget
 * en el navegador viaja junto con el resto del formulario y ACÁ se valida
 * contra la API de Cloudflare antes de procesar lo que sea que haga la ruta.
 *
 * Site key (pública) → NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * Secret key (privada) → TURNSTILE_SECRET_KEY
 * Se consiguen gratis en: https://dash.cloudflare.com/?to=/:account/turnstile
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(
  token: unknown,
  remoteIp?: string | null
): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    // Sin la key configurada no hay forma de validar nada. En producción
    // esto tiene que ser un error duro (fail-closed) para no terminar con
    // el captcha "de adorno" en el frontend pero sin ningún freno real en
    // el server. En desarrollo local se deja pasar para no obligar a
    // configurar Cloudflare solo para levantar el proyecto.
    if (process.env.NODE_ENV === 'production') {
      console.error('TURNSTILE_SECRET_KEY no configurada — rechazando por seguridad');
      return false;
    }
    return true;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('Error verificando Turnstile:', err);
    return false;
  }
}

/** Extrae la IP del visitante de la misma forma que src/lib/rateLimit.ts */
export function getClientIp(req: Request): string | null {
  const headers = req.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    null
  );
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimiters } from '@/lib/rateLimit';
import { verifyTurnstile, getClientIp } from '@/lib/turnstile';

/**
 * POST /api/auth/login
 *
 * Antes, el login llamaba a supabase.auth.signInWithPassword() directo
 * desde el navegador — sin pasar por ningún servidor propio, no había
 * forma de aplicarle un límite de intentos desde esta app (el preset
 * `rateLimiters.auth` existía pero quedaba sin uso posible). Este
 * endpoint hace de intermediario: valida el límite de intentos ACÁ
 * antes de reenviar la consulta a Supabase, y como corre en el
 * servidor, deja la cookie de sesión ya lista en la respuesta (el
 * cliente no necesita hacer nada extra con el token).
 *
 * No reemplaza la protección propia de Supabase Auth (que sigue
 * activa igual), la complementa con un freno adicional que si controla
 * esta app.
 *
 * ✅ NUEVO: se suma Turnstile (mismo captcha que ya usan /auth/registro
 * y el formulario de contacto) — el rate limit por IP no alcanza contra
 * bots que rotan de IP o hacen credential stuffing lento para no
 * gatillar el límite. El login es, de los tres formularios, el que más
 * lo necesita: es el blanco más común de ataques automatizados.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimiters.auth(req);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const captchaOk = await verifyTurnstile(
    (body as Record<string, unknown>).turnstileToken,
    getClientIp(req)
  );
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'Verificación anti-bot fallida. Recargá la página e intentá de nuevo.' },
      { status: 403 }
    );
  }

  const email    = body?.email?.toString().trim().toLowerCase();
  const password = body?.password?.toString();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 422 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensaje genérico a propósito — no distinguir "no existe la cuenta"
    // de "contraseña incorrecta" evita que alguien use el login para
    // averiguar qué emails están registrados (enumeración de usuarios).
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
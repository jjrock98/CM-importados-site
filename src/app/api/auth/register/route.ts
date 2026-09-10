import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimiters } from '@/lib/rateLimit';
import { verifyTurnstile, getClientIp } from '@/lib/turnstile';
import { z } from 'zod';

/**
 * POST /api/auth/register
 *
 * Antes, /auth/registro llamaba a supabase.auth.signUp() directo desde el
 * navegador — igual que le pasaba al login antes de tener /api/auth/login,
 * eso significa CERO freno propio: ni rate limit, ni captcha, nada que este
 * proyecto controle. Un bot podía crear cuentas en loop.
 *
 * Este endpoint hace de intermediario, con el mismo patrón que ya se usa en
 * /api/auth/login: valida captcha + límite de intentos ACÁ, y como corre en
 * el servidor, deja la cookie de sesión lista igual que hacía el signUp
 * directo del cliente.
 */

const schema = z.object({
  nombre:   z.string().min(2).max(100),
  email:    z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const limited = rateLimiters.register(req);
  if (limited) return limited;

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });

  const captchaOk = await verifyTurnstile(
    (rawBody as Record<string, unknown>).turnstileToken,
    getClientIp(req)
  );
  if (!captchaOk) {
    return NextResponse.json(
      { error: 'Verificación anti-bot fallida. Recargá la página e intentá de nuevo.' },
      { status: 403 }
    );
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 });
  }
  const { nombre, email, password } = parsed.data;

  const origin = req.nextUrl.origin;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data:            { full_name: nombre.trim() },
      emailRedirectTo: `${origin}/auth/verificar`,
    },
  });

  if (error) {
    // Mismo criterio que el login: mensaje específico solo para el caso de
    // "ya existe" (es información que el propio flujo de Supabase ya expone
    // igual al intentar loguearse con ese email), genérico para el resto.
    if (error.message.includes('already registered')) {
      return NextResponse.json({ error: 'Este email ya está registrado. ¿Querés iniciar sesión?' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
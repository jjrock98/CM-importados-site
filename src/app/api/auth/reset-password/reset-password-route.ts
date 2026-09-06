import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';
import { createClient } from '@/lib/supabase/server';
import { rateLimiters } from '@/lib/rateLimit';

/**
 * POST /api/auth/reset-password
 *
 * Mismo motivo que /api/auth/login: antes esto llamaba a
 * supabase.auth.resetPasswordForEmail() directo desde el navegador, sin
 * ningún freno propio. Acá el riesgo no es tanto "adivinar" una
 * contraseña, sino que alguien use este formulario para bombardear la
 * casilla de un tercero con emails de "restablecer contraseña" sin
 * parar. Se responde siempre con el mismo mensaje de éxito exista o no
 * la cuenta, para no revelar qué emails están registrados.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimiters.auth(req);
  if (limited) return limited;

  const body  = await req.json().catch(() => null);
  const email = body?.email?.toString().trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 422 });

  const appUrl = env.APP_URL || new URL(req.url).origin;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/update-password`,
  });

  // Siempre 200 — no confirmar ni negar si el email existe en el sistema.
  return NextResponse.json({ ok: true });
}
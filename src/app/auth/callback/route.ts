import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Callback de OAuth (Google, Facebook) al que Supabase redirige después
 * de que la persona confirma (o rechaza) el login en el proveedor.
 *
 * ✅ FIX: antes esta ruta ignoraba cualquier error por completo — tanto
 * si el proveedor devolvía un `?error=` en la URL (por ejemplo, alguien
 * cancela el diálogo de permisos de Facebook) como si
 * `exchangeCodeForSession()` fallaba del lado de Supabase (por ejemplo,
 * ya existe una cuenta con ese mismo email creada por otro medio —
 * email/contraseña o el otro proveedor — y el intercambio se rechaza).
 * En ambos casos, antes se redirigía igual a `next` como si el login
 * hubiera sido exitoso: la persona terminaba en el sitio sin sesión y
 * sin ningún mensaje que le explicara qué pasó.
 *
 * Ahora, ante cualquiera de los dos casos, se redirige de vuelta a
 * /auth/login con un mensaje de error legible (login/page.tsx ya tiene
 * el mismo patrón para el aviso de "sesión expirada por inactividad").
 */
export async function GET(request: Request) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get('code');
  const next  = url.searchParams.get('next') ?? '/';

  // Caso 1: el proveedor (Facebook/Google) devolvió un error directo —
  // ej. la persona canceló el diálogo de permisos, o el proveedor
  // rechazó el pedido (como el "Invalid Scopes" que se vio al probar
  // Facebook Login for Business).
  const providerError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (providerError) {
    const loginUrl = new URL('/auth/login', url.origin);
    loginUrl.searchParams.set('error', providerError);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Caso 2: Supabase rechazó el intercambio del código por una sesión
    // — por ejemplo, conflicto porque ya existe una cuenta con ese email
    // creada por otro medio.
    if (error) {
      const loginUrl = new URL('/auth/login', url.origin);
      loginUrl.searchParams.set(
        'error',
        'No pudimos completar el inicio de sesión. Si ya tenés una cuenta creada con este email, ingresá con ese método y vinculá Facebook/Google desde tu perfil.'
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
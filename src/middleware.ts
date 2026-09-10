import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import { rateLimit } from '@/lib/rateLimit';

const PROFILE_REQUIRED_ROUTES = ['/mis-pedidos', '/wishlist'];
// ✅ /checkout no requiere perfil completo — invitados llenan los datos en el form
const AUTH_REQUIRED_ROUTES    = ['/mis-pedidos', '/wishlist', '/completar-perfil', '/perfil'];
// ✅ /checkout NO requiere login — permite compra como invitado
const ADMIN_ROUTES             = ['/admin'];

// ✅ NUEVO: timeout de inactividad implementado acá, a nivel app.
// Originalmente la idea era usar Authentication → Sessions → "Tiempo de
// espera de inactividad" del dashboard de Supabase, pero esa sección
// completa está bloqueada en el plan Gratuito (pide Plan Pro) — con lo
// cual, sin este código, NINGUNA sesión expiraba nunca, ni de clientes ni
// de admin. Se resuelve con el mismo mecanismo para los dos casos (ver
// enforceIdleTimeout más abajo), con un límite más estricto para /admin
// por manejar datos sensibles del negocio (pedidos, clientes, pagos).
const USER_IDLE_LIMIT_SECONDS  = 2 * 60 * 60; // 2hs sin actividad → logout (clientes)
const ADMIN_IDLE_LIMIT_SECONDS = 30 * 60;     // 30 min sin actividad → logout (admin)

const MAINTENANCE_BYPASS = ['/admin', '/auth', '/api', '/mantenimiento'];

type UpdateSessionResult = Awaited<ReturnType<typeof updateSession>>;

// Chequea inactividad comparando timestamps guardados en una cookie propia
// (separada de la sesión de Supabase) y, si se venció, hace signOut() de
// verdad — revoca el refresh token en el server, no alcanza con borrar la
// cookie del navegador. Devuelve la respuesta de redirect si hay que cerrar
// sesión, o null si todavía está dentro del límite.
//
// ⚠️ El maxAge de la cookie es siempre bastante más largo que limitSeconds.
// Si fueran iguales, el propio navegador borraría la cookie justo cuando se
// cumple el límite de inactividad — ANTES de que este código pueda leerla —
// y entonces se interpretaría como "primera visita" en vez de "sesión
// inactiva", y el logout automático nunca se dispararía. La decisión real
// la toma siempre la comparación de timestamps de abajo, nunca la
// expiración nativa de la cookie.
async function enforceIdleTimeout(
  request: NextRequest,
  supabase: UpdateSessionResult['supabase'],
  supabaseResponse: NextResponse,
  cookieName: string,
  limitSeconds: number,
  redirectTo: string
): Promise<NextResponse | null> {
  const lastActivityRaw = request.cookies.get(cookieName)?.value;
  const now = Date.now();
  const lastActivity = lastActivityRaw ? parseInt(lastActivityRaw, 10) : null;
  const isIdle = lastActivity !== null && !isNaN(lastActivity) &&
    now - lastActivity > limitSeconds * 1000;

  if (isIdle) {
    await supabase.auth.signOut();
    const url = new URL('/auth/login', request.url);
    url.searchParams.set('redirect', redirectTo);
    url.searchParams.set('expired', '1');
    const redirectResponse = NextResponse.redirect(url);
    // Propaga a esta respuesta las cookies que signOut() acaba de vaciar en
    // supabaseResponse (el signOut real pasa por el callback setAll que usa
    // updateSession()).
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    redirectResponse.cookies.delete(cookieName);
    return redirectResponse;
  }

  supabaseResponse.cookies.set(cookieName, String(now), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: limitSeconds * 4, // piso de seguridad, no el límite real (ver comentario arriba)
  });
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Freno global anti-flood ────────────────────────────────────────────
  // ✅ NUEVO: antes, el rate limiting solo estaba en algunas rutas /api
  // puntuales (checkout, contacto, etc.) — el resto del sitio (home,
  // listado de productos, TODAS las rutas /admin, webhooks) no tenía
  // ningún freno propio. Esto no reemplaza una protección real de DDoS
  // (eso tiene que pasar en la capa de red, antes de que el tráfico
  // llegue acá — ver Cloudflare/Vercel Firewall), pero corta de raíz un
  // flood simple de una sola fuente antes de que gaste cómputo/DB en
  // cada request. El límite es generoso a propósito: no debería afectar
  // a un usuario real navegando rápido.
  const floodCheck = rateLimit(request, { limit: 300, windowSecs: 60, prefix: 'global' });
  if (floodCheck) return floodCheck;

  // ── CSRF: verificación de Origin en requests que modifican datos ──────────
  // ✅ NUEVO: las cookies de sesión de Supabase ya usan SameSite=Lax por
  // defecto (bloquea que un formulario/fetch de OTRO sitio ande enviando
  // esta cookie), pero se suma esta capa extra: si el navegador manda el
  // header Origin (lo hace en la enorme mayoría de los POST/PUT/PATCH/
  // DELETE reales) y no coincide con este mismo sitio, se corta antes de
  // llegar a la ruta. Se excluye el webhook de Mercado Pago porque ese
  // tráfico es servidor-a-servidor (no manda Origin de navegador) y ya
  // se valida por firma criptográfica en la propia ruta.
  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/webhooks/')
  ) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
    }
  }

  // ── Bloqueo geográfico anti-fraude (solo rutas de pago/pedidos) ───────────
  // Vercel agrega el header x-vercel-ip-country en su borde de red antes de
  // que el request llegue acá — no se puede falsificar desde el navegador
  // (el proxy de Vercel pisa cualquier valor que mande el cliente con ese
  // nombre). A propósito NO se bloquea todo el sitio: solo las rutas que
  // efectivamente crean un pedido o cobran, para no afectar a Googlebot, a
  // los bots de vista previa de WhatsApp/Meta al compartir un link, ni a un
  // comprador argentino navegando el catálogo desde afuera del país (solo
  // se corta si además intenta pagar/generar el pedido). El webhook de
  // Mercado Pago queda afuera: ese tráfico es servidor-a-servidor, no del
  // comprador, y ya se valida por firma criptográfica en la propia ruta.
  const GEO_RESTRICTED_ROUTES = ['/api/orders', '/api/checkout'];
  const PAIS_PERMITIDO = 'AR';
  if (
    request.method === 'POST' &&
    GEO_RESTRICTED_ROUTES.some((r) => pathname.startsWith(r)) &&
    !pathname.startsWith('/api/webhooks/')
  ) {
    const pais = request.headers.get('x-vercel-ip-country');
    // Si el header no viene (dev local, o proveedor sin geolocalización) se
    // deja pasar — fail-open — para no romper nunca el flujo de compra por
    // un dato que no siempre está disponible fuera de producción en Vercel.
    if (pais && pais !== PAIS_PERMITIDO) {
      return NextResponse.json(
        { error: 'Por el momento solo procesamos pedidos realizados desde Argentina.' },
        { status: 403 }
      );
    }
  }

  // ── Modo mantenimiento ────────────────────────────────────────────────────
  // Lee de ENV como toggle rápido (para activar sin redeploy vía Vercel UI),
  // o de site_settings en DB (para que el admin lo controle desde el panel).
  const isBypass = MAINTENANCE_BYPASS.some((p) => pathname.startsWith(p));
  if (!isBypass) {
    let isMaintenanceActive = process.env.MAINTENANCE_MODE === 'true';

    // Si la env var no lo activa, consultar DB (más flexible para el admin)
    if (!isMaintenanceActive) {
      try {
        const adminSupabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { cookies: { getAll: () => [], setAll: () => {} } }
        );
        const { data } = await adminSupabase
          .from('site_settings')
          .select('valor')
          .eq('clave', 'mantenimiento')
          .single();
        isMaintenanceActive = data?.valor === 'true';
      } catch {
        // Si falla la consulta, no activar mantenimiento (fail-open es más seguro)
      }
    }

    if (isMaintenanceActive && pathname !== '/mantenimiento') {
      return NextResponse.redirect(new URL('/mantenimiento', request.url));
    }
  }

  const { supabaseResponse, user, supabase } = await updateSession(request);

  // ── Timeout de inactividad para cualquier usuario logueado ────────────────
  // Reemplaza la config de Supabase (Authentication → Sessions), que en el
  // plan Gratuito está bloqueada — ver comentario junto a USER_IDLE_LIMIT_
  // SECONDS. /admin queda afuera porque más abajo tiene su propio control,
  // más estricto (30 min en vez de 2hs).
  // Se excluye /api/: son llamadas fetch del frontend (ej. el panel de admin
  // pega a /api/admin/*), no navegación de página — si se les devuelve un
  // redirect en vez del JSON esperado, se rompen en silencio. La sesión
  // igual queda cerrada del lado de Supabase la próxima vez que el usuario
  // navegue a una página real; la ventana en la que una llamada a /api/
  // pasa sin chequear inactividad es un trade-off aceptado.
  if (user && !pathname.startsWith('/api/') && !ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const idleResponse = await enforceIdleTimeout(
      request, supabase, supabaseResponse,
      'user_last_activity', USER_IDLE_LIMIT_SECONDS, pathname
    );
    if (idleResponse) return idleResponse;
  }

  // ── Auth required ──────────────────────────────────────────────────────────
  if (AUTH_REQUIRED_ROUTES.some((r) => pathname.startsWith(r)) && !user) {
    const url = new URL('/auth/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // ── Admin check ────────────────────────────────────────────────────────────
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!user) return NextResponse.redirect(new URL('/auth/login?redirect=/admin', request.url));
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single();
    if (profile?.rol !== 'admin') return NextResponse.redirect(new URL('/', request.url));

    // ✅ NUEVO: exige el segundo factor (2FA/TOTP) para entrar al panel.
    // getAuthenticatorAssuranceLevel() lee el nivel actual de la sesión
    // (aal1 = solo contraseña) vs el nivel que exige la cuenta según los
    // factores que tenga registrados (aal2 en cuanto el admin activa 2FA
    // desde /admin/configuracion). Si no coinciden, la sesión pasó el login
    // pero todavía no pasó el segundo paso — se manda a completarlo antes
    // de mostrar cualquier dato del panel. Si el admin nunca activó 2FA,
    // currentLevel === nextLevel === 'aal1' y esto no lo afecta en nada.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      const url = new URL('/auth/mfa', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // Logout automático del admin por inactividad (30 min) — ver
    // enforceIdleTimeout arriba. Se excluye /api/admin/* por el mismo
    // motivo que el bloque de arriba: son llamadas fetch del panel, no
    // navegación de página.
    if (!pathname.startsWith('/api/')) {
      const idleResponse = await enforceIdleTimeout(
        request, supabase, supabaseResponse,
        'admin_last_activity', ADMIN_IDLE_LIMIT_SECONDS, '/admin'
      );
      if (idleResponse) return idleResponse;
    }
  }

  // ── Datos mínimos de contacto para rutas críticas ─────────────────────────
  // ✅ FIX: antes exigía domicilio + código postal + teléfono completos, lo
  // cual bloqueaba a cualquier cliente que solo compra para retirar en el
  // local (nunca carga una dirección de envío porque no la necesita) — se
  // topaba con esta pantalla la primera vez que quería ver sus propios
  // pedidos. El checkout ya vuelve a pedir la dirección completa si el
  // cliente elige envío a domicilio, así que acá alcanza con el teléfono
  // (igual es indispensable: es el dato que usamos para el aviso de
  // WhatsApp y para verificar el retiro en el local).
  if (PROFILE_REQUIRED_ROUTES.some((r) => pathname.startsWith(r)) && user) {
    const { data: profile } = await supabase
      .from('profiles').select('telefono').eq('id', user.id).single();
    const isIncomplete = !profile?.telefono;
    if (isIncomplete && pathname !== '/completar-perfil') {
      const url = new URL('/completar-perfil', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
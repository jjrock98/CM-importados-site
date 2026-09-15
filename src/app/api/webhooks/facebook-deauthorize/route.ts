import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyFacebookSignedRequest } from '@/lib/facebookSignedRequest';

/**
 * POST /api/auth/facebook/deauthorize
 *
 * Meta llama a esta URL server-a-server cuando alguien revoca el acceso
 * de "CM importados" desde su configuración de Facebook (Configuración →
 * Apps y sitios web) — es decir, cuando lo hace DESDE Facebook, sin pasar
 * nunca por nuestro sitio. Se configura en Meta for Developers → tu app →
 * Inicio de sesión con Facebook → Configurar → "URL de devolución de
 * llamada para autorización cancelada".
 *
 * Importante — esto es DISTINTO de la eliminación de datos (/eliminar-
 * datos, que ya existe): acá alguien solo cortó la conexión con
 * Facebook, no necesariamente pidió borrar su cuenta ni sus datos. Por
 * eso este endpoint NO borra ni desvincula nada automáticamente — deja
 * un registro para que el admin lo vea, y listo. Si en algún momento
 * hace falta actuar sobre esto (por ejemplo, forzar que esa persona
 * vuelva a loguearse con email/contraseña la próxima vez), se decide con
 * ese registro a la vista, no en automático.
 *
 * Meta manda esto como `application/x-www-form-urlencoded` con un único
 * campo `signed_request` — un JWT-like firmado con el App Secret que
 * incluye el `user_id` (ID de Facebook) de quien revocó el acceso. Hay
 * que verificar esa firma antes de confiar en el contenido: cualquiera
 * podría mandar un POST acá con datos inventados si no se valida.
 */
export async function POST(req: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  // Si no está configurado el secret, no hay forma segura de verificar
  // la firma — mejor no procesar nada que confiar en un request sin
  // validar. Devuelve 200 igual (no queremos que Meta reintente en loop
  // por algo que no vamos a poder resolver sin la variable de entorno).
  if (!appSecret) {
    console.error('[FB deauthorize] Falta configurar FACEBOOK_APP_SECRET — se ignora el request.');
    return NextResponse.json({ ok: true });
  }

  const contentType = req.headers.get('content-type') ?? '';
  let signedRequest: string | null = null;

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(await req.text());
      signedRequest = params.get('signed_request');
    } else {
      // Por si Meta cambia el content-type en el futuro, o para probarlo
      // manualmente con un POST en JSON.
      const body = await req.json().catch(() => null);
      signedRequest = body?.signed_request ?? null;
    }
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  if (!signedRequest) {
    return NextResponse.json({ error: 'Falta signed_request' }, { status: 400 });
  }

  const payload = verifyFacebookSignedRequest(signedRequest, appSecret);
  if (!payload) {
    console.error('[FB deauthorize] signed_request con firma inválida — se descarta.');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  console.log(`[FB deauthorize] Usuario de Facebook ${payload.user_id} revocó el acceso a la app.`);

  // Registro de auditoría — mismo patrón que el resto del sistema
  // (webhook de Mercado Pago, cron de stock, etc.) en notificaciones_admin.
  // `order_id` queda null porque esto no está atado a ningún pedido; el
  // ID de Facebook se guarda en `error` reutilizando ese campo como
  // "info adicional", tal como ya se hace en otros crons del proyecto.
  const admin = createAdminClient();
  await admin.from('notificaciones_admin').insert({
    tipo:     'in_app',
    evento:   'facebook_deauthorized',
    order_id: null,
    enviado:  true,
    error:    `Facebook user_id: ${payload.user_id}`,
  });

  // Meta no exige un formato de respuesta particular para este callback
  // (a diferencia del de eliminación de datos) — con un 200 alcanza para
  // que no reintenten.
  return NextResponse.json({ ok: true });
}

// Usa el módulo `crypto` de Node (HMAC) — no corre en el runtime Edge.
export const runtime = 'nodejs';
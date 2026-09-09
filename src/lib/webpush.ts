import webpush from 'web-push';
import { createAdminClient } from './supabase/admin';
import { sendAdminTelegramNotification } from './telegram';

// ✅ Lazy init — igual que Resend y MP, no instanciar a nivel de módulo
let configured = false;

function configureWebPush() {
  if (configured) return;
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email      = process.env.VAPID_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'admin@mitienda.com';
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body:  string;
  tag?:  string;
  data?: Record<string, string>;
}

/**
 * Envía una notificación push a TODOS los dispositivos registrados
 * del admin (puede tener múltiples: PC + celular).
 * Silencia errores de subscripciones expiradas (las borra automáticamente).
 *
 * También dispara, en paralelo, la misma notificación por Telegram (ver
 * ./telegram.ts) — es un canal independiente del push por navegador, así
 * que llega igual aunque no tengas el push del navegador configurado o
 * activo en ese momento. Se llama desde acá y no en cada ruta porque esta
 * función ya es el punto único donde el resto del código avisa "pasó algo
 * que el admin necesita ver ahora" (pedido nuevo, cancelación, comprobante
 * a verificar, pago aprobado, reembolso automático).
 */
export async function sendAdminPushNotification(payload: PushPayload): Promise<void> {
  sendAdminTelegramNotification(payload.title, payload.body).catch((err) =>
    console.error('[Telegram] Error enviando notificación:', err)
  );

  configureWebPush();
  if (!configured) {
    // VAPID no configurado — no falla, solo loguea
    console.warn('[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas. Las notificaciones push no se enviarán hasta configurarlas en Vercel.');
    return;
  }

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (!subscriptions || subscriptions.length === 0) {
    console.warn('[Push] No hay suscripciones registradas en push_subscriptions — no se envía nada.');
    return;
  }

  const payloadStr = JSON.stringify(payload);
  const expiredEndpoints: string[] = [];
  let sentCount = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        );
        sentCount++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Suscripción expirada o inválida — marcar para borrar
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error('[Push] Error enviando notificación:', err);
        }
      }
    })
  );

  console.log(`[Push] "${payload.title}" → enviada a ${sentCount}/${subscriptions.length} dispositivo(s)${expiredEndpoints.length ? `, ${expiredEndpoints.length} suscripción(es) expirada(s) eliminada(s)` : ''}.`);

  // Limpiar suscripciones expiradas
  if (expiredEndpoints.length > 0) {
    await admin.from('push_subscriptions')
      .delete().in('endpoint', expiredEndpoints);
  }
}
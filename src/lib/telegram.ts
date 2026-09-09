/**
 * Notificación instantánea al admin vía bot de Telegram.
 *
 * Por qué Telegram y no WhatsApp: mandar un WhatsApp de forma automática
 * (sin que nadie haga clic en un link wa.me) requiere la API de WhatsApp
 * Business de Meta — cuenta de negocio verificada + plantillas de mensaje
 * aprobadas, un trámite que puede tardar días. Telegram no pide ninguna
 * aprobación: se crea el bot hablándole a @BotFather, se consigue el
 * chat_id, y ya se pueden mandar mensajes gratis e instantáneos. El día
 * que la integración de WhatsApp esté lista, se puede sumar como canal
 * extra acá mismo sin tocar los puntos donde se llama a esta función.
 *
 * No lanza si falta configuración ni si falla el request — mismo patrón
 * que sendAdminPushNotification: nunca debe romper el flujo de una venta,
 * cancelación o subida de comprobante por un problema de notificaciones.
 *
 * Configuración necesaria (variables de entorno en Vercel):
 *   TELEGRAM_BOT_TOKEN → el token que te da @BotFather al crear el bot.
 *   TELEGRAM_CHAT_ID   → tu chat_id (se consigue escribiéndole una vez al
 *                        bot y consultando https://api.telegram.org/bot<TOKEN>/getUpdates).
 */
export async function sendAdminTelegramNotification(title: string, body: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID no configuradas — no se envía nada.');
    return;
  }

  // Reintento único ante fallas de red transitorias: en funciones
  // serverless (Vercel) es común que el primer fetch de una conexión
  // "en frío" falle con ECONNRESET al establecer TLS — un problema
  // conocido de reciclado de conexiones en Node, no un error de la
  // configuración. Un segundo intento casi siempre conecta bien, así que
  // no vale la pena perder la notificación por eso.
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `${title}\n${body}`,
        }),
      });

      if (!res.ok) {
        console.error('[Telegram] Error enviando notificación:', await res.text());
      }
      return; // éxito (o error de la API, no de red) — no reintentar
    } catch (err) {
      if (intento === 2) {
        console.error('[Telegram] Error de red enviando notificación (tras reintento):', err);
      }
      // si es el primer intento, sigue el loop y reintenta una vez
    }
  }
}
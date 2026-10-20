-- ══════════════════════════════════════════════════════════════════════
-- push_subscriptions: guardar el ORIGEN (dominio) de cada suscripción
-- ══════════════════════════════════════════════════════════════════════
-- Una suscripción Web Push es por origen. Si el mismo navegador se suscribió
-- desde localhost, el dominio de Vercel y el dominio real, cada aviso llegaba
-- 2 o 3 veces. src/lib/webpush.ts filtra por esta columna y
-- /api/admin/push-subscribe la completa al suscribir.
--
-- Las filas viejas quedan con origin NULL (el código las sigue enviando).
-- Idempotente. Si la columna no existe, el código igual funciona (reintenta
-- sin ella), pero los avisos se duplican.
--
-- NOTA: reconstruido a partir de cómo el código usa la columna (texto, nullable);
-- el archivo original no estaba en el repo.
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS origin TEXT;

COMMENT ON COLUMN push_subscriptions.origin IS
  'Origen (https://mc-importados.shop) desde el que se creó la suscripción push. NULL = suscripciones viejas.';
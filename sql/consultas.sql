-- ══════════════════════════════════════════════════════════════════════
-- consultas.sql — diagnósticos y migraciones puntuales (versión limpia)
-- Cambios respecto de la versión anterior:
--   * cost_simulations: las 3 copias del CREATE TABLE quedaron en una sola
--     (con la columna "compra"), más el ALTER de precio_recomendado.
--   * El bucket "comprobantes" usa application/pdf (antes image/pdf).
--   * El "FIX CRÍTICO" del trigger de rol se reemplazó por una referencia
--     a sql/fixes/2026-10-16_hardening.sql, que tiene la versión nueva
--     (si se re-corría la vieja, volvía a bloquear al SQL Editor).
-- ══════════════════════════════════════════════════════════════════════


-- ── DIAGNÓSTICO: devolver_stock_seguro / stock ─────────────────────────
-- 1. Qué versión de la función está REALMENTE activa en tu base
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'devolver_stock_seguro';

-- 2. Si la versión activa depende de estas dos, tienen que existir
SELECT proname FROM pg_proc
WHERE proname IN ('_devolver_stock_item', '_devolver_stock_curva');

-- 3. Stock actual del producto "prueba"
SELECT id, nombre, stock_unidades, venta_mayorista, venta_minorista
FROM products
WHERE nombre = 'prueba';

-- 4. Estado real de un pedido (reemplazá el UUID completo,
--    lo sacás de la URL del panel /admin/pedidos al abrir ese pedido)
-- SELECT id, estado, stock_descontado, updated_at
-- FROM orders
-- WHERE id = 'PEGAR-UUID-COMPLETO-ACA';


-- ══════════════════════════════════════════════════════════════════════
-- FIX PUNTUAL: crear el bucket "comprobantes" (y sus policies)
-- Resuelve el error "Bucket not found". No toca tablas, triggers ni datos.
-- Seguro de correr aunque ya exista (ON CONFLICT + DROP POLICY IF EXISTS).
-- Si el bucket YA existía con 'image/pdf', el UPDATE de
-- 2026-10-16_hardening.sql es el que lo corrige.
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('comprobantes','comprobantes',FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "comprobantes_auth_upload" ON storage.objects;
CREATE POLICY "comprobantes_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'comprobantes' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "comprobantes_own_read" ON storage.objects;
CREATE POLICY "comprobantes_own_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'comprobantes'
    AND (auth.uid()::TEXT = (storage.foldername(name))[1] OR is_admin())
  );

-- Verificación rápida: debe devolver una fila con "comprobantes".
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'comprobantes';


-- ══════════════════════════════════════════════════════════════════════
-- FIX CRÍTICO DE SEGURIDAD: trigger anti-escalada de rol
-- → Movido a sql/fixes/2026-10-16_hardening.sql (sección 2), que además
--   permite cambiar roles desde el SQL Editor. No volver a pegar acá la
--   versión vieja de _prevent_role_self_escalation().
-- ══════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION: Pago en efectivo (retiro/micro) + Entrega en micros (La Salada)
-- ══════════════════════════════════════════════════════════════════════
-- 'efectivo': nuevo método de pago. Solo se ofrece para tipo_entrega
-- 'retiro' o 'micro' — NUNCA para 'envio' a domicilio (se valida también
-- en la app, esto es defensa en profundidad a nivel de datos).
--
-- A diferencia de 'transferencia', el stock de un pedido en efectivo NO
-- se reserva al crearse la orden — recién se reserva/descuenta cuando el
-- admin confirma que cobró el pedido, reutilizando el mismo endpoint y
-- RPC (reservar_stock_orden_manual) que ya usa "Confirmar pago manual".
--
-- 'micro': tercer tipo_entrega, exclusivo de la feria La Salada. El
-- comprador elige una de 3 terminales de micros, indica la empresa/nombre
-- del micro en el que viaja el pedido, y el nombre de quien lo recibe en
-- destino (puede no ser el comprador — compra anónima o para un tercero).
-- No lleva código de retiro (eso es solo para 'retiro' en el local).
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_metodo_pago_check;
ALTER TABLE orders ADD CONSTRAINT orders_metodo_pago_check
  CHECK (metodo_pago IN ('mercadopago','transferencia','cuenta_corriente','efectivo'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_tipo_entrega_check;
ALTER TABLE orders ADD CONSTRAINT orders_tipo_entrega_check
  CHECK (tipo_entrega IN ('envio','retiro','micro'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS micro_terminal           TEXT,
  ADD COLUMN IF NOT EXISTS micro_empresa_transporte TEXT,
  ADD COLUMN IF NOT EXISTS micro_nombre_recibe      TEXT;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_micro_terminal_check;
ALTER TABLE orders ADD CONSTRAINT orders_micro_terminal_check
  CHECK (micro_terminal IS NULL OR micro_terminal IN ('punta_mogote','urkupinia','ocean'));

COMMENT ON COLUMN orders.micro_terminal           IS 'Terminal de micros elegida (solo La Salada): punta_mogote | urkupinia | ocean';
COMMENT ON COLUMN orders.micro_empresa_transporte IS 'Nombre del micro y/o empresa de transporte indicado por el cliente';
COMMENT ON COLUMN orders.micro_nombre_recibe      IS 'Nombre de la persona que recibe el pedido en destino (comprador o un tercero autorizado)';

CREATE INDEX IF NOT EXISTS idx_orders_micro_terminal ON orders(micro_terminal) WHERE micro_terminal IS NOT NULL;


-- ── Consultas ─────────────────────────────────────────────────────────
-- Transferencias con stock ya descontado y pedido aún sin pagar
SELECT id, created_at, estado, stock_descontado
FROM orders
WHERE metodo_pago = 'transferencia'
  AND estado IN ('pendiente','pendiente_pago')
  AND stock_descontado = TRUE
ORDER BY created_at;

-- Últimas 20 transferencias
SELECT id, created_at, estado, stock_descontado, metodo_pago
FROM orders
WHERE metodo_pago = 'transferencia'
ORDER BY created_at DESC
LIMIT 20;

-- Un pedido puntual
SELECT id, created_at, updated_at, estado, rejection_reason
FROM orders
WHERE id = '72237228-6d08-4fc0-ac2d-4dfea1a22216';


-- ============================================================
-- MÓDULO: Análisis y Reportes de Costos por Docena (admin)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_costs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  costo_compra_docena  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo_compra_docena >= 0),
  transporte_docena    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (transporte_docena >= 0),
  empaque_docena       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (empaque_docena >= 0),
  otros_docena         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (otros_docena >= 0),
  notas                TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_costs_product ON product_costs(product_id);

COMMENT ON TABLE product_costs IS
  'Costos de un producto expresados por docena (bulto), no por unidad. Alimenta el simulador de márgenes del admin — no tiene efecto sobre products.precio_docena hasta que el admin decide aplicarlo manualmente.';

CREATE TABLE IF NOT EXISTS cost_settings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre         TEXT NOT NULL,
  monto_mensual  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_mensual >= 0),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cost_settings IS
  'Gastos fijos mensuales del negocio (alquiler, sueldo ayudante, etc.) a prorratear por docena en el simulador de costos. Editable libremente por el admin — no afecta nada fuera del reporte.';

CREATE TABLE IF NOT EXISTS cost_period_config (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  periodo            TEXT NOT NULL UNIQUE,
  docenas_estimadas  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (docenas_estimadas >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_period_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on product_costs" ON product_costs;
CREATE POLICY "Service role full access on product_costs"
  ON product_costs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on cost_settings" ON cost_settings;
CREATE POLICY "Service role full access on cost_settings"
  ON cost_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on cost_period_config" ON cost_period_config;
CREATE POLICY "Service role full access on cost_period_config"
  ON cost_period_config FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ── Historial de simulaciones de costos (solo admin) ───────────────────
-- (Versión única: antes estaba repetida 3 veces en este archivo.)
CREATE TABLE IF NOT EXISTS cost_simulations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             TEXT NOT NULL,
  product_id         UUID REFERENCES products(id) ON DELETE SET NULL,
  precio_docena      NUMERIC(14,2) NOT NULL CHECK (precio_docena >= 0),
  docenas_compra     NUMERIC(10,2) NOT NULL CHECK (docenas_compra > 0),
  cotizacion_usd     NUMERIC(12,2),
  cotizacion_origen  TEXT CHECK (cotizacion_origen IN ('blue','manual')),
  cotizacion_fecha   TIMESTAMPTZ,
  costo_real_docena  NUMERIC(14,2) NOT NULL,
  ganancia_docena    NUMERIC(14,2) NOT NULL,
  margen_pct         NUMERIC(14,2) NOT NULL,
  markup_pct         NUMERIC(14,2) NOT NULL,
  veredicto          TEXT NOT NULL CHECK (veredicto IN ('optimo','bajo_objetivo','perdida')),
  notas              TEXT,
  inputs             JSONB NOT NULL,
  resultados         JSONB NOT NULL,
  compra             JSONB,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_simulations_created ON cost_simulations(created_at DESC);

-- Por si la tabla ya existía de una versión anterior sin estas columnas:
ALTER TABLE cost_simulations ADD COLUMN IF NOT EXISTS compra JSONB;
ALTER TABLE cost_simulations ADD COLUMN IF NOT EXISTS precio_recomendado NUMERIC(14,2);

ALTER TABLE cost_simulations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on cost_simulations" ON cost_simulations;
CREATE POLICY "Service role full access on cost_simulations"
  ON cost_simulations FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- Búsqueda de productos SIN distinguir acentos ("pantalon" encuentra "Pantalón")
-- y a prueba de caracteres especiales (%, _, comas, paréntesis).
--
-- Lo usan /api/search/suggest (autocompletado) y /buscar. Si esta función no
-- existe, el código cae solo a una búsqueda ilike común (sin ignorar acentos).
-- Idempotente (se puede correr más de una vez).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.search_products(
  q                   text,
  include_description boolean DEFAULT false,
  max_results         int     DEFAULT 40
)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY INVOKER              -- respeta RLS: solo se ven los productos públicos
SET search_path = public, extensions
AS $$
  WITH t AS (
    -- Escapa \ % _ para que se busquen como texto literal dentro del ILIKE.
    SELECT '%' || unaccent(regexp_replace(trim(q), '([\\%_])', '\\\1', 'g')) || '%' AS pat
  )
  SELECT p.*
  FROM public.products p, t
  WHERE length(trim(q)) >= 2
    AND p.activo = TRUE
    AND p.venta_mayorista = TRUE
    AND (
      unaccent(p.nombre) ILIKE t.pat
      OR (
        include_description
        AND (
          unaccent(coalesce(p.descripcion, ''))       ILIKE t.pat OR
          unaccent(coalesce(p.descripcion_corta, '')) ILIKE t.pat
        )
      )
    )
  ORDER BY p.destacado DESC, p.stock_unidades DESC
  LIMIT least(greatest(max_results, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, boolean, int) TO anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION: Gastos fijos pagados por día (ej. sueldo de un empleado
-- que cobra por jornada trabajada, no un monto fijo mensual cerrado)
-- ══════════════════════════════════════════════════════════════════════
-- cost_settings admitía solo un monto mensual cargado a mano. Esta
-- migración agrega un segundo modo ('por_dia'): el admin carga días
-- trabajados y pago por día, y monto_mensual se calcula y se guarda solo
-- (dias_mes * pago_por_dia).
-- Retrocompatible: los gastos existentes quedan con tipo = 'fijo'.
-- 100% idempotente: ADD COLUMN IF NOT EXISTS; el CHECK va aparte con
-- DROP CONSTRAINT IF EXISTS (si fuera inline y la columna ya existiera,
-- Postgres no lo crearía nunca).
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE cost_settings
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'fijo',
  ADD COLUMN IF NOT EXISTS dias_mes NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS pago_por_dia NUMERIC(10,2);

ALTER TABLE cost_settings DROP CONSTRAINT IF EXISTS cost_settings_tipo_check;
ALTER TABLE cost_settings ADD CONSTRAINT cost_settings_tipo_check
  CHECK (tipo IN ('fijo', 'por_dia'));

COMMENT ON COLUMN cost_settings.tipo IS
  'fijo = monto_mensual cargado directo (alquiler, despensas, etc.). por_dia = se paga por jornada trabajada (ej. sueldo del empleado) — monto_mensual se calcula como dias_mes * pago_por_dia y se recalcula solo cuando se edita cualquiera de los dos desde /admin/costos.';
COMMENT ON COLUMN cost_settings.dias_mes IS
  'Solo aplica si tipo = por_dia: cantidad de días que trabajó en el mes.';
COMMENT ON COLUMN cost_settings.pago_por_dia IS
  'Solo aplica si tipo = por_dia: monto que se le paga por cada día trabajado.';


-- ══════════════════════════════════════════════════════════════════════
-- LIMPIEZA DE STORAGE (bucket "products") — solo lectura, no borra nada
-- Correr cada bloque por separado en el SQL Editor.
-- ══════════════════════════════════════════════════════════════════════

-- BLOQUE 1 — Lista de archivos sin usar (los que se pueden borrar)
-- ============================================================
CREATE OR REPLACE FUNCTION pg_temp.url_decode(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT convert_from(
    coalesce(string_agg(
      CASE WHEN t.m[1] IS NOT NULL THEN decode(substring(t.m[1] from 2), 'hex')
           ELSE convert_to(t.m[2], 'UTF8') END,
      '\x'::bytea ORDER BY t.ord), '\x'::bytea),
    'UTF8')
  FROM regexp_matches(p, '(%[0-9a-fA-F]{2})|([^%]+|%)', 'g') WITH ORDINALITY AS t(m, ord)
$$;

WITH refs AS (
  SELECT unnest(imagenes) AS url FROM products
  UNION
  SELECT imagen_url FROM product_variants WHERE imagen_url IS NOT NULL
  UNION
  SELECT imagen_snap FROM order_items WHERE imagen_snap IS NOT NULL
),
refs_path AS (
  SELECT DISTINCT pg_temp.url_decode(
           split_part(split_part(regexp_replace(url, '^.*/storage/v1/object/public/products/', ''), '?', 1), '#', 1)
         ) AS path
  FROM refs
  WHERE url LIKE '%/storage/v1/object/public/products/%'
)
SELECT
  o.name                                       AS archivo,
  round((o.metadata->>'size')::numeric / 1024) AS kb,
  o.created_at::date                           AS subido
FROM storage.objects o
WHERE o.bucket_id = 'products'
  AND o.created_at < now() - interval '1 day'
  AND NOT EXISTS (SELECT 1 FROM refs_path r WHERE r.path = o.name)
ORDER BY o.created_at;


-- BLOQUE 2 — Resumen: cuántos archivos sin usar hay y cuánto espacio ocupan
-- ============================================================
CREATE OR REPLACE FUNCTION pg_temp.url_decode(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT convert_from(
    coalesce(string_agg(
      CASE WHEN t.m[1] IS NOT NULL THEN decode(substring(t.m[1] from 2), 'hex')
           ELSE convert_to(t.m[2], 'UTF8') END,
      '\x'::bytea ORDER BY t.ord), '\x'::bytea),
    'UTF8')
  FROM regexp_matches(p, '(%[0-9a-fA-F]{2})|([^%]+|%)', 'g') WITH ORDINALITY AS t(m, ord)
$$;

WITH refs AS (
  SELECT unnest(imagenes) AS url FROM products
  UNION
  SELECT imagen_url FROM product_variants WHERE imagen_url IS NOT NULL
  UNION
  SELECT imagen_snap FROM order_items WHERE imagen_snap IS NOT NULL
),
refs_path AS (
  SELECT DISTINCT pg_temp.url_decode(
           split_part(split_part(regexp_replace(url, '^.*/storage/v1/object/public/products/', ''), '?', 1), '#', 1)
         ) AS path
  FROM refs
  WHERE url LIKE '%/storage/v1/object/public/products/%'
)
SELECT
  count(*)                                                             AS archivos_sin_usar,
  round(coalesce(sum((o.metadata->>'size')::numeric), 0) / 1048576, 2) AS mb_ocupados
FROM storage.objects o
WHERE o.bucket_id = 'products'
  AND o.created_at < now() - interval '1 day'
  AND NOT EXISTS (SELECT 1 FROM refs_path r WHERE r.path = o.name);


-- BLOQUE 3 — Control: imágenes usadas por productos/pedidos que YA NO existen
-- en el storage (si hay filas, esas fotos se ven rotas en el sitio o en pedidos viejos)
-- ============================================================
CREATE OR REPLACE FUNCTION pg_temp.url_decode(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT convert_from(
    coalesce(string_agg(
      CASE WHEN t.m[1] IS NOT NULL THEN decode(substring(t.m[1] from 2), 'hex')
           ELSE convert_to(t.m[2], 'UTF8') END,
      '\x'::bytea ORDER BY t.ord), '\x'::bytea),
    'UTF8')
  FROM regexp_matches(p, '(%[0-9a-fA-F]{2})|([^%]+|%)', 'g') WITH ORDINALITY AS t(m, ord)
$$;

WITH refs AS (
  SELECT unnest(imagenes) AS url FROM products
  UNION
  SELECT imagen_url FROM product_variants WHERE imagen_url IS NOT NULL
  UNION
  SELECT imagen_snap FROM order_items WHERE imagen_snap IS NOT NULL
),
refs_path AS (
  SELECT DISTINCT pg_temp.url_decode(
           split_part(split_part(regexp_replace(url, '^.*/storage/v1/object/public/products/', ''), '?', 1), '#', 1)
         ) AS path
  FROM refs
  WHERE url LIKE '%/storage/v1/object/public/products/%'
)
SELECT r.path AS usada_pero_no_existe_en_storage
FROM refs_path r
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'products' AND o.name = r.path
)
ORDER BY r.path;


-- BLOQUE 4 — Las 30 fotos en uso más pesadas
-- ============================================================
CREATE OR REPLACE FUNCTION pg_temp.url_decode(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT convert_from(
    coalesce(string_agg(
      CASE WHEN t.m[1] IS NOT NULL THEN decode(substring(t.m[1] from 2), 'hex')
           ELSE convert_to(t.m[2], 'UTF8') END,
      '\x'::bytea ORDER BY t.ord), '\x'::bytea),
    'UTF8')
  FROM regexp_matches(p, '(%[0-9a-fA-F]{2})|([^%]+|%)', 'g') WITH ORDINALITY AS t(m, ord)
$$;

WITH fotos AS (
  -- Una fila por cada foto de cada producto, con el archivo real del storage.
  SELECT
    p.nombre,
    p.activo,
    i.pos,
    o.name                                  AS archivo,
    (o.metadata->>'size')::numeric / 1024   AS kb
  FROM products p
  CROSS JOIN LATERAL unnest(p.imagenes) WITH ORDINALITY AS i(url, pos)
  JOIN storage.objects o
    ON o.bucket_id = 'products'
   AND o.name = pg_temp.url_decode(
         split_part(split_part(regexp_replace(i.url, '^.*/storage/v1/object/public/products/', ''), '?', 1), '#', 1)
       )
  WHERE i.url LIKE '%/storage/v1/object/public/products/%'
)
SELECT
  nombre    AS producto,
  activo,
  pos       AS posicion,
  round(kb) AS kb,
  archivo
FROM fotos
ORDER BY kb DESC
LIMIT 30;


-- BLOQUE 5 — Resumen de peso de las fotos en uso
-- ============================================================
CREATE OR REPLACE FUNCTION pg_temp.url_decode(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT convert_from(
    coalesce(string_agg(
      CASE WHEN t.m[1] IS NOT NULL THEN decode(substring(t.m[1] from 2), 'hex')
           ELSE convert_to(t.m[2], 'UTF8') END,
      '\x'::bytea ORDER BY t.ord), '\x'::bytea),
    'UTF8')
  FROM regexp_matches(p, '(%[0-9a-fA-F]{2})|([^%]+|%)', 'g') WITH ORDINALITY AS t(m, ord)
$$;

WITH fotos AS (
  SELECT
    p.nombre,
    p.activo,
    i.pos,
    o.name                                  AS archivo,
    (o.metadata->>'size')::numeric / 1024   AS kb
  FROM products p
  CROSS JOIN LATERAL unnest(p.imagenes) WITH ORDINALITY AS i(url, pos)
  JOIN storage.objects o
    ON o.bucket_id = 'products'
   AND o.name = pg_temp.url_decode(
         split_part(split_part(regexp_replace(i.url, '^.*/storage/v1/object/public/products/', ''), '?', 1), '#', 1)
       )
  WHERE i.url LIKE '%/storage/v1/object/public/products/%'
)
SELECT
  count(*)                                         AS fotos_en_uso,
  round(sum(kb) / 1024, 1)                         AS mb_totales,
  round(avg(kb))                                   AS kb_promedio,
  count(*) FILTER (WHERE kb > 1024)                AS mayores_a_1mb,
  count(*) FILTER (WHERE kb > 500 AND kb <= 1024)  AS entre_500kb_y_1mb,
  count(*) FILTER (WHERE pos = 1 AND kb > 500)     AS principales_mayores_a_500kb
FROM fotos;
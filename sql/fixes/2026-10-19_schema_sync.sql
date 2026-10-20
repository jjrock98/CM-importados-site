-- ══════════════════════════════════════════════════════════════════════
-- SYNC 2026-10-19 — pone en sql/schema.sql lo que la base de producción ya
-- tiene pero el schema del repo no: pago en efectivo + entrega en micros,
-- estado 'rechazado', módulo de costos, búsqueda sin acentos, gastos por
-- día y reseñas de producto.
--
-- Idempotente (se puede correr las veces que haga falta) y NO toca datos.
-- NO incluye a propósito: el trigger anti-escalada de rol y el bucket
-- "comprobantes" (ya quedan bien con 2026-10-16_hardening.sql).
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

-- ============================================================
-- Estado 'rechazado' (distinto de 'cancelado')
-- 'cancelado' → el cliente cancela antes de pagar.
-- 'rechazado' → el admin rechaza el comprobante de transferencia.
-- ============================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_estado_check;
ALTER TABLE orders ADD CONSTRAINT orders_estado_check
  CHECK (estado IN ('pendiente','pendiente_pago','pagado','procesando','enviado','entregado','cancelado','rechazado'));

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


-- ═══════════════════════════════════════════════════════════════════════
-- Reseñas de producto — solo clientes con un pedido ENTREGADO de ese
-- producto pueden reseñarlo (lo obliga RLS, no solo la UI). Nacen ocultas
-- (aprobado = FALSE) y se moderan desde /admin/resenas.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS product_reviews (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nombre_cliente TEXT NOT NULL,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comentario     TEXT NOT NULL CHECK (char_length(comentario) BETWEEN 10 AND 1000),
  aprobado       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx
  ON product_reviews(product_id) WHERE aprobado = TRUE;
CREATE INDEX IF NOT EXISTS product_reviews_pendientes_idx
  ON product_reviews(created_at) WHERE aprobado = FALSE;

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_read_approved" ON product_reviews;
CREATE POLICY "reviews_public_read_approved" ON product_reviews
  FOR SELECT USING (aprobado = TRUE);

DROP POLICY IF EXISTS "reviews_own_read" ON product_reviews;
CREATE POLICY "reviews_own_read" ON product_reviews
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_admin_all" ON product_reviews;
CREATE POLICY "reviews_admin_all" ON product_reviews
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "reviews_insert_verified_purchase" ON product_reviews;
CREATE POLICY "reviews_insert_verified_purchase" ON product_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = product_reviews.product_id
        AND o.user_id = auth.uid()
        AND o.estado = 'entregado'
    )
  );
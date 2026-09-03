-- ============================================================
-- ECOMMERCE SCHEMA - Supabase PostgreSQL
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extended from auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  nombre        TEXT,
  avatar_url    TEXT,
  direccion     TEXT,
  ciudad        TEXT,
  codigo_postal TEXT,
  telefono      TEXT,
  rol           TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre               TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  descripcion          TEXT,
  descripcion_corta    TEXT,
  imagenes             TEXT[] NOT NULL DEFAULT '{}',
  stock_unidades       INT NOT NULL DEFAULT 0 CHECK (stock_unidades >= 0),
  precio_media_docena  NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_docena        NUMERIC(10,2) NOT NULL DEFAULT 0,
  colores              TEXT[] DEFAULT '{}',
  talles               TEXT[] DEFAULT '{}',
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  destacado            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_slug_idx ON products(slug);
CREATE INDEX IF NOT EXISTS products_activo_idx ON products(activo);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email                TEXT NOT NULL,
  nombre               TEXT NOT NULL,
  telefono             TEXT,
  direccion            TEXT NOT NULL,
  ciudad               TEXT NOT NULL,
  codigo_postal        TEXT NOT NULL,
  estado               TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','pagado','procesando','enviado','entregado','cancelado')),
  metodo_pago          TEXT NOT NULL CHECK (metodo_pago IN ('mercadopago','stripe','transferencia')),
  mp_preference_id     TEXT,
  mp_payment_id        TEXT,
  stripe_session_id    TEXT,
  stripe_payment_id    TEXT,
  comprobante_url      TEXT,
  subtotal             NUMERIC(10,2) NOT NULL DEFAULT 0,
  costo_envio          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total                NUMERIC(10,2) NOT NULL DEFAULT 0,
  notas                TEXT,
  stock_descontado     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_estado_idx ON orders(estado);
CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx ON orders(mp_payment_id);
CREATE INDEX IF NOT EXISTS orders_stripe_session_id_idx ON orders(stripe_session_id);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  tipo_pack     TEXT NOT NULL CHECK (tipo_pack IN ('media_docena','docena')),
  cantidad_packs INT NOT NULL CHECK (cantidad_packs > 0),
  unidades      INT NOT NULL CHECK (unidades > 0),
  precio_unit   NUMERIC(10,2) NOT NULL,
  subtotal      NUMERIC(10,2) NOT NULL,
  nombre_snap   TEXT NOT NULL,
  imagen_snap   TEXT
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- Wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON wishlists(user_id);

-- Shipping zones
CREATE TABLE IF NOT EXISTS shipping_zones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  codigos_postales TEXT[] NOT NULL DEFAULT '{}',
  costo         NUMERIC(10,2) NOT NULL DEFAULT 0,
  dias_entrega  TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contact messages
CREATE TABLE IF NOT EXISTS contact_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL,
  asunto     TEXT,
  mensaje    TEXT NOT NULL,
  leido      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contact info (single row)
CREATE TABLE IF NOT EXISTS contact_info (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT,
  telefono   TEXT,
  whatsapp   TEXT,
  instagram  TEXT,
  facebook   TEXT,
  horario    TEXT,
  direccion  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Location info (single row)
CREATE TABLE IF NOT EXISTS location_info (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mapa_iframe_url TEXT,
  descripcion     TEXT,
  video1_url      TEXT,
  video1_titulo   TEXT,
  video2_url      TEXT,
  video2_titulo   TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank info (single row)
CREATE TABLE IF NOT EXISTS bank_info (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titular         TEXT,
  cbu             TEXT,
  alias           TEXT,
  banco           TEXT,
  tipo_cuenta     TEXT,
  cuit            TEXT,
  instrucciones   TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Site settings (key-value)
CREATE TABLE IF NOT EXISTS site_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave       TEXT NOT NULL UNIQUE,
  valor       TEXT,
  descripcion TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INITIAL DATA
-- ============================================================

INSERT INTO site_settings (clave, valor, descripcion)
VALUES
  ('mantenimiento', 'false', 'Modo mantenimiento activo/inactivo'),
  ('mantenimiento_mensaje', 'Estamos realizando mejoras. Volvemos pronto.', 'Mensaje de mantenimiento'),
  ('nombre_tienda', 'CM Importados', 'Nombre de la tienda'),
  ('descripcion_tienda', 'Venta mayorista de indumentaria importada — packs por docena y curva surtida', 'Descripción SEO de la tienda')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO contact_info (email, telefono, whatsapp, horario)
VALUES ('contacto@mitienda.com', '+54 11 0000-0000', '5491100000000', 'Lunes a Viernes 9-18hs')
ON CONFLICT DO NOTHING;

INSERT INTO location_info (mapa_iframe_url, descripcion)
VALUES ('https://www.google.com/maps/embed?...', 'Visitanos en nuestra tienda física.')
ON CONFLICT DO NOTHING;

INSERT INTO bank_info (titular, banco, tipo_cuenta)
VALUES ('Mi Tienda S.A.', 'Banco Nación', 'Cuenta Corriente')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FUNCIÓN: descontar_stock_seguro (con lock)
-- ============================================================
CREATE OR REPLACE FUNCTION descontar_stock_seguro(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order         orders%ROWTYPE;
  v_item          order_items%ROWTYPE;
  v_product       products%ROWTYPE;
  v_errors        TEXT[] := '{}';
BEGIN
  -- Obtener el pedido con lock
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya descontado');
  END IF;

  -- Verificar disponibilidad de stock primero
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    SELECT * INTO v_product FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN
      v_errors := array_append(v_errors, 'Producto no encontrado: ' || v_item.product_id::TEXT);
    ELSIF v_product.stock_unidades < v_item.unidades THEN
      v_errors := array_append(v_errors, 
        'Stock insuficiente para "' || v_product.nombre || '": disponible=' || 
        v_product.stock_unidades::TEXT || ', requerido=' || v_item.unidades::TEXT
      );
    END IF;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', to_jsonb(v_errors));
  END IF;

  -- Descontar stock
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE products
    SET stock_unidades = stock_unidades - v_item.unidades,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  -- Marcar como descontado y actualizar estado
  UPDATE orders
  SET stock_descontado = TRUE,
      estado = 'pagado',
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Stock descontado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, nombre, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    nombre     = COALESCE(profiles.nombre, EXCLUDED.nombre),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ✅ Idempotencia: DROP antes de CREATE — Postgres no soporta
-- "CREATE TRIGGER IF NOT EXISTS", así que sin este DROP, re-correr este
-- archivo sobre una base ya provisionada tira "trigger already exists"
-- y aborta el script completo (afecta también a todo lo que esté más
-- abajo en el archivo, como los índices nuevos al final).
DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
DROP TRIGGER IF EXISTS set_updated_at_products ON products;
DROP TRIGGER IF EXISTS set_updated_at_orders   ON orders;
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_orders   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_info     ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_info    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_info        ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings    ENABLE ROW LEVEL SECURITY;

-- Helper: is_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
  );
$$;

-- profiles
CREATE POLICY "profiles_select_own"    ON profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_update_own"    ON profiles FOR UPDATE USING (auth.uid() = id OR is_admin()) WITH CHECK (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_insert_own"    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- products (public read, admin write)
CREATE POLICY "products_public_read"   ON products FOR SELECT USING (activo = TRUE OR is_admin());
CREATE POLICY "products_admin_insert"  ON products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "products_admin_update"  ON products FOR UPDATE USING (is_admin());
CREATE POLICY "products_admin_delete"  ON products FOR DELETE USING (is_admin());

-- orders
CREATE POLICY "orders_select"          ON orders FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "orders_insert_auth"     ON orders FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.uid() IS NOT NULL);
CREATE POLICY "orders_update_admin"    ON orders FOR UPDATE USING (is_admin());

-- order_items
CREATE POLICY "order_items_select"     ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR is_admin()))
);
CREATE POLICY "order_items_insert"     ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

-- wishlists
CREATE POLICY "wishlists_own"          ON wishlists FOR ALL USING (user_id = auth.uid());

-- shipping_zones (public read, admin write)
CREATE POLICY "shipping_zones_read"    ON shipping_zones FOR SELECT USING (activo = TRUE OR is_admin());
CREATE POLICY "shipping_zones_admin"   ON shipping_zones FOR ALL USING (is_admin());

-- contact_messages (insert public, read admin)
CREATE POLICY "contact_messages_insert" ON contact_messages FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "contact_messages_admin"  ON contact_messages FOR SELECT USING (is_admin());
CREATE POLICY "contact_messages_update" ON contact_messages FOR UPDATE USING (is_admin());

-- contact_info, location_info, bank_info (read public, write admin)
CREATE POLICY "contact_info_read"      ON contact_info    FOR SELECT USING (TRUE);
CREATE POLICY "contact_info_admin"     ON contact_info    FOR ALL    USING (is_admin());
CREATE POLICY "location_info_read"     ON location_info   FOR SELECT USING (TRUE);
CREATE POLICY "location_info_admin"    ON location_info   FOR ALL    USING (is_admin());
CREATE POLICY "bank_info_read"         ON bank_info       FOR SELECT USING (TRUE);
CREATE POLICY "bank_info_admin"        ON bank_info       FOR ALL    USING (is_admin());

-- site_settings (read public, write admin)
CREATE POLICY "site_settings_read"     ON site_settings   FOR SELECT USING (TRUE);
CREATE POLICY "site_settings_admin"    ON site_settings   FOR ALL    USING (is_admin());

-- Storage bucket for product images and receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('products',    'products',    TRUE,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('comprobantes','comprobantes',FALSE, 10485760, ARRAY['image/jpeg','image/png','image/pdf','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "products_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "products_admin_upload"    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products' AND is_admin());
CREATE POLICY "products_admin_delete"    ON storage.objects FOR DELETE USING (bucket_id = 'products' AND is_admin());
CREATE POLICY "comprobantes_auth_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'comprobantes' AND auth.uid() IS NOT NULL);
CREATE POLICY "comprobantes_own_read"    ON storage.objects FOR SELECT USING (bucket_id = 'comprobantes' AND (auth.uid()::TEXT = (storage.foldername(name))[1] OR is_admin()));

-- ============================================================
-- MIGRATION: Add rejection_reason to orders
-- ============================================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS comprobante_revisado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN orders.rejection_reason IS 'Motivo de rechazo del comprobante por parte del admin';
COMMENT ON COLUMN orders.comprobante_revisado IS 'True cuando el admin revisó el comprobante (aprobado o rechazado)';

-- Migration: add tipo_entrega to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tipo_entrega TEXT NOT NULL DEFAULT 'envio'
    CHECK (tipo_entrega IN ('envio', 'retiro'));

COMMENT ON COLUMN orders.tipo_entrega IS 'envio = entrega a domicilio, retiro = retiro en local';

-- ============================================================
-- MIGRATION: Cash payment support (efectivo MP)
-- ============================================================

-- New columns for MP payment tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fecha_pago       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mp_status_detail TEXT;

COMMENT ON COLUMN orders.fecha_pago       IS 'Fecha en que el pago fue confirmado por MP';
COMMENT ON COLUMN orders.mp_status_detail IS 'status_detail de MP: waiting_for_payment, accredited, etc.';

-- Update estado CHECK constraint to include 'pendiente_pago'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_estado_check;
ALTER TABLE orders ADD CONSTRAINT orders_estado_check
  CHECK (estado IN (
    'pendiente',       -- Pedido creado, aún no inició pago
    'pendiente_pago',  -- Cupón de efectivo generado, esperando pago físico
    'pagado',          -- Pago confirmado (webhook approved)
    'procesando',      -- Admin lo está preparando
    'enviado',         -- En camino
    'entregado',       -- Entregado/retirado
    'cancelado'        -- Cancelado por cualquier motivo
  ));

-- ============================================================
-- FUNCIÓN: devolver_stock_seguro (restaurar stock en rechazos)
-- ============================================================
CREATE OR REPLACE FUNCTION devolver_stock_seguro(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order  orders%ROWTYPE;
  v_item   order_items%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF NOT v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock no había sido descontado');
  END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE products
      SET stock_unidades = stock_unidades + v_item.unidades,
          updated_at     = NOW()
      WHERE id = v_item.product_id;
  END LOOP;

  UPDATE orders
    SET stock_descontado = FALSE,
        updated_at       = NOW()
    WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Stock restaurado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- RLS: admin can call both stock functions
GRANT EXECUTE ON FUNCTION descontar_stock_seguro(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION devolver_stock_seguro(UUID)  TO service_role;

-- ============================================================
-- MIGRATION: Trazabilidad de admin (seguridad / auditoría)
-- ============================================================
-- Guarda qué admin aprobó/rechazó un comprobante de transferencia.
-- Útil en cuanto haya más de un usuario con rol admin: permite saber
-- quién tomó cada decisión sobre un pago.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN orders.reviewed_by IS 'ID del admin que aprobó o rechazó el comprobante de este pedido';

-- ============================================================
-- MIGRATION: cart_reservations (reserva temporal de stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS cart_reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  session_id  TEXT    NOT NULL,
  unidades    INT     NOT NULL CHECK (unidades > 0),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_reservations_session   ON cart_reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_reservations_expires   ON cart_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_cart_reservations_product   ON cart_reservations(product_id);

ALTER TABLE cart_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on cart_reservations"
  ON cart_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- MIGRATION: codigo_retiro en orders
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS codigo_retiro TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_codigo_retiro ON orders(codigo_retiro);

-- Política RLS: el cliente puede ver su propio código de retiro
DROP POLICY IF EXISTS "Clients can see own order pickup code" ON orders;

-- ============================================================
-- FUNCTION: reservar_stock_carrito
-- ============================================================
CREATE OR REPLACE FUNCTION reservar_stock_carrito(
  p_product_id UUID,
  p_session_id TEXT,
  p_unidades   INT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stock_disponible INT;
  v_reservado_otros  INT;
BEGIN
  -- Limpiar reservas expiradas de cualquier sesión
  DELETE FROM cart_reservations WHERE expires_at < NOW();

  -- Calcular stock disponible (total - reservado por OTRAS sesiones)
  SELECT p.stock_unidades INTO v_stock_disponible
    FROM products p WHERE p.id = p_product_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado');
  END IF;

  SELECT COALESCE(SUM(r.unidades), 0) INTO v_reservado_otros
    FROM cart_reservations r
    WHERE r.product_id = p_product_id
      AND r.session_id  <> p_session_id
      AND r.expires_at  > NOW();

  IF (v_stock_disponible - v_reservado_otros) < p_unidades THEN
    RETURN jsonb_build_object(
      'success',   false,
      'error',     'Stock insuficiente',
      'disponible', (v_stock_disponible - v_reservado_otros)
    );
  END IF;

  INSERT INTO cart_reservations (product_id, session_id, unidades, expires_at)
    VALUES (p_product_id, p_session_id, p_unidades, NOW() + INTERVAL '15 minutes')
    ON CONFLICT (product_id, session_id) DO UPDATE
      SET unidades   = EXCLUDED.unidades,
          expires_at = NOW() + INTERVAL '15 minutes';

  RETURN jsonb_build_object('success', true, 'reservado', p_unidades);
END;
$$;

-- ============================================================
-- FUNCTION: liberar_reserva_carrito
-- ============================================================
CREATE OR REPLACE FUNCTION liberar_reserva_carrito(
  p_session_id TEXT,
  p_product_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_product_id IS NOT NULL THEN
    DELETE FROM cart_reservations
      WHERE session_id = p_session_id AND product_id = p_product_id;
  ELSE
    DELETE FROM cart_reservations WHERE session_id = p_session_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- FUNCTION: descontar_stock_solo
-- (descuenta stock sin cambiar estado del pedido)
-- ============================================================
CREATE OR REPLACE FUNCTION descontar_stock_solo(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order  orders%ROWTYPE;
  v_item   order_items%ROWTYPE;
  v_stock  INT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya descontado');
  END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    SELECT stock_unidades INTO v_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF v_stock < v_item.unidades THEN
      RETURN jsonb_build_object('success', false, 'error',
        format('Stock insuficiente para producto %s', v_item.product_id));
    END IF;
    UPDATE products SET stock_unidades = stock_unidades - v_item.unidades,
      updated_at = NOW() WHERE id = v_item.product_id;
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION reservar_stock_carrito(UUID, TEXT, INT) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION liberar_reserva_carrito(TEXT, UUID)     TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION descontar_stock_solo(UUID)              TO service_role;

-- ============================================================
-- MIGRATION: stock_notifications ("Avísame cuando haya stock")
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  notified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, email)
);
CREATE INDEX IF NOT EXISTS idx_stock_notif_product ON stock_notifications(product_id);

ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe to stock notifications"
  ON stock_notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Service role full access on stock_notifications"
  ON stock_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- MIGRATION: push_subscriptions (Web Push para admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role full access on push_subscriptions"
  ON push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- MIGRATION: Venta minorista
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS venta_minorista      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS precio_unitario      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS stock_minorista_min  INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stock_minorista_max  INT NOT NULL DEFAULT 12;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tipo_venta TEXT CHECK (tipo_venta IN ('mayorista','minorista'));

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_tipo_pack_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_tipo_pack_check
  CHECK (tipo_pack IN ('media_docena','docena','unidad'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_estado_check;
ALTER TABLE orders ADD CONSTRAINT orders_estado_check
  CHECK (estado IN ('pendiente','pendiente_pago','pagado','procesando','enviado','entregado','cancelado'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_metodo_pago_check;
ALTER TABLE orders ADD CONSTRAINT orders_metodo_pago_check
  CHECK (metodo_pago IN ('mercadopago','transferencia'));

CREATE INDEX IF NOT EXISTS idx_products_minorista ON products(venta_minorista) WHERE venta_minorista = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_tipo_venta  ON orders(tipo_venta);

-- stock_notifications: ya se creó arriba (línea ~631) — sin duplicar la definición.

-- ============================================================
-- MIGRATION: TikTok en contact_info
-- ============================================================
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS tiktok TEXT;
COMMENT ON COLUMN contact_info.tiktok IS 'URL del perfil de TikTok (ej: https://tiktok.com/@mitienda)';

-- ============================================================
-- ARQUITECTURA: Supavisor Connection Pooler (Puerto 6543)
-- ============================================================
-- Problema en entornos serverless (Vercel Edge/Functions):
-- Cada invocación crea una conexión PostgreSQL nueva. Sin pooler,
-- bajo picos de tráfico se agotan las conexiones disponibles y
-- los SELECT FOR UPDATE (usados en reservar_stock_carrito) pueden
-- quedar en deadlock esperando conexiones libres.
--
-- Solución: Supabase Supavisor en MODO TRANSACCIÓN (puerto 6543).
-- - Todas las conexiones desde Vercel apuntan a este puerto.
-- - Supavisor agrupa y reutiliza conexiones al pool de PostgreSQL.
-- - Las transacciones con FOR UPDATE duran milisegundos, no
--   saturando el pool de conexiones disponibles.
-- - En .env.local usar la DATABASE_URL con puerto 6543:
--   postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
-- - IMPORTANTE: ?pgbouncer=true deshabilita prepared statements
--   incompatibles con el modo transacción de PgBouncer/Supavisor.
-- ============================================================

-- ============================================================
-- TABLA: notificaciones_admin
-- Registro de todas las notificaciones enviadas al admin
-- (email + push) para auditoría y debugging.
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones_admin (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         TEXT NOT NULL CHECK (tipo IN ('email','push','in_app')),
  evento       TEXT NOT NULL,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  enviado      BOOLEAN NOT NULL DEFAULT FALSE,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_admin_order ON notificaciones_admin(order_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_admin_tipo  ON notificaciones_admin(tipo, created_at DESC);

ALTER TABLE notificaciones_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on notificaciones_admin"
  ON notificaciones_admin FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE notificaciones_admin IS
  'Log de notificaciones al admin — útil para debugging de webhooks y auditoría de alertas push/email.';

-- ============================================================
-- REFACTOR: Reglas de negocio de stock — separación estricta
-- entre "carrito" (sin reserva) y "orden manual" (con reserva)
-- ============================================================

-- ── Configuración: tiempo de retención para pagos manuales ────
-- El admin configura esto desde el panel. Valor en HORAS.
INSERT INTO site_settings (clave, valor, descripcion)
VALUES
  ('retencion_horas_transferencia', '48', 'Horas que se retiene el stock reservado para pedidos con transferencia/efectivo antes de cancelar automáticamente y liberar stock')
ON CONFLICT (clave) DO NOTHING;

-- ── FUNCTION: reservar_stock_orden_manual ──────────────────────
-- Reserva stock DEFINITIVAMENTE (resta de products.stock_unidades)
-- en el momento exacto en que se crea una orden con método de pago
-- manual/diferido (transferencia, efectivo coordinado). A diferencia
-- de la vieja reservar_stock_carrito, esta NO se llama al agregar
-- al carrito — solo al confirmar "Finalizar Pedido".
--
-- Usa SELECT FOR UPDATE por cada producto para evitar condiciones
-- de carrera: si dos clientes intentan reservar el último artículo
-- casi simultáneamente, Postgres serializa el acceso a la fila y
-- solo el primero en completar la transacción se queda con el stock.
CREATE OR REPLACE FUNCTION reservar_stock_orden_manual(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order   orders%ROWTYPE;
  v_item    order_items%ROWTYPE;
  v_stock   INT;
  v_faltantes JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya reservado para este pedido');
  END IF;

  -- Primera pasada: verificar stock suficiente para TODOS los items
  -- antes de descontar nada (evita descuentos parciales).
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    SELECT stock_unidades INTO v_stock
      FROM products WHERE id = v_item.product_id FOR UPDATE;

    IF v_stock IS NULL OR v_stock < v_item.unidades THEN
      v_faltantes := v_faltantes || jsonb_build_object(
        'product_id', v_item.product_id,
        'nombre',     v_item.nombre_snap,
        'disponible', COALESCE(v_stock, 0),
        'solicitado', v_item.unidades
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_faltantes) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Stock insuficiente al momento de confirmar el pedido',
      'faltantes', v_faltantes
    );
  END IF;

  -- Segunda pasada: descontar (ya garantizamos que hay stock para todos)
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    UPDATE products
      SET stock_unidades = stock_unidades - v_item.unidades,
          updated_at     = NOW()
      WHERE id = v_item.product_id;
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Stock reservado para pago manual');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION reservar_stock_orden_manual(UUID) TO service_role;

COMMENT ON FUNCTION reservar_stock_orden_manual IS
  'Reserva stock (resta definitivamente) SOLO para pedidos con método de pago manual/diferido, en el momento de crear la orden. Para Mercado Pago, el stock se descuenta únicamente vía descontar_stock_seguro tras el webhook approved — nunca antes.';

-- ============================================================
-- FEATURE: Variantes de producto (talla × color) — solo minorista
-- ============================================================
-- Cada combinación talla+color tiene su propio stock independiente.
-- Los productos SIN variantes siguen usando products.stock_unidades
-- como hasta ahora (retrocompatible). Los pedidos mayoristas (packs)
-- nunca usan variantes — solo aplica al canal minorista.

CREATE TABLE IF NOT EXISTS product_variants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  talla          TEXT NOT NULL,
  color          TEXT NOT NULL,
  stock_unidades INT  NOT NULL DEFAULT 0 CHECK (stock_unidades >= 0),
  sku            TEXT,
  imagen_url     TEXT,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, talla, color)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_stock   ON product_variants(product_id, stock_unidades) WHERE activo = TRUE;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cualquiera puede ver variantes activas"
  ON product_variants FOR SELECT TO anon, authenticated USING (activo = TRUE);
CREATE POLICY "Service role full access on product_variants"
  ON product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE product_variants IS
  'Combinaciones talla+color con stock independiente. Un producto minorista puede tener 0 (usa stock general) o N variantes.';

-- ── Videos del producto (además de imágenes) ────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}';
COMMENT ON COLUMN products.videos IS 'URLs de video (YouTube/Vimeo/mp4 directo) mostrados en la ficha del producto';

-- ── order_items: referencia opcional a la variante comprada ─────
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_snap TEXT; -- ej: "Talla M / Azul", para mostrar en pedidos aunque la variante se borre después
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);

-- ============================================================
-- FUNCTION: descontar_stock_variante_seguro
-- Helper interno: descuenta de product_variants si hay variant_id,
-- o de products si no lo hay. Reutilizado por las 3 funciones
-- principales para no duplicar la lógica de bifurcación.
-- ============================================================
CREATE OR REPLACE FUNCTION _descontar_stock_item(p_variant_id UUID, p_product_id UUID, p_unidades INT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_stock INT;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT stock_unidades INTO v_stock FROM product_variants WHERE id = p_variant_id FOR UPDATE;
    IF v_stock IS NULL OR v_stock < p_unidades THEN
      RETURN jsonb_build_object('ok', false, 'disponible', COALESCE(v_stock, 0));
    END IF;
    UPDATE product_variants SET stock_unidades = stock_unidades - p_unidades, updated_at = NOW()
      WHERE id = p_variant_id;
  ELSE
    SELECT stock_unidades INTO v_stock FROM products WHERE id = p_product_id FOR UPDATE;
    IF v_stock IS NULL OR v_stock < p_unidades THEN
      RETURN jsonb_build_object('ok', false, 'disponible', COALESCE(v_stock, 0));
    END IF;
    UPDATE products SET stock_unidades = stock_unidades - p_unidades, updated_at = NOW()
      WHERE id = p_product_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION _devolver_stock_item(p_variant_id UUID, p_product_id UUID, p_unidades INT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants SET stock_unidades = stock_unidades + p_unidades, updated_at = NOW()
      WHERE id = p_variant_id;
  ELSE
    UPDATE products SET stock_unidades = stock_unidades + p_unidades, updated_at = NOW()
      WHERE id = p_product_id;
  END IF;
END;
$$;

-- ============================================================
-- REEMPLAZO: descontar_stock_seguro — ahora es variant-aware
-- (Mercado Pago, en webhook approved)
-- ============================================================
CREATE OR REPLACE FUNCTION descontar_stock_seguro(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order   orders%ROWTYPE;
  v_item    order_items%ROWTYPE;
  v_stock   INT;
  v_errors  TEXT[] := '{}';
  v_result  JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya descontado');
  END IF;

  -- Verificación: producto o variante, según corresponda
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT stock_unidades INTO v_stock FROM product_variants WHERE id = v_item.variant_id FOR UPDATE;
    ELSE
      SELECT stock_unidades INTO v_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
    END IF;

    IF v_stock IS NULL OR v_stock < v_item.unidades THEN
      v_errors := array_append(v_errors,
        'Stock insuficiente para "' || v_item.nombre_snap ||
        COALESCE(' (' || v_item.variant_snap || ')', '') ||
        '": disponible=' || COALESCE(v_stock, 0)::TEXT || ', requerido=' || v_item.unidades::TEXT
      );
    END IF;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', to_jsonb(v_errors));
  END IF;

  -- Descuento real (ya garantizado que hay stock para todos)
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    v_result := _descontar_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock descontado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- REEMPLAZO: devolver_stock_seguro — ahora es variant-aware
-- ============================================================
CREATE OR REPLACE FUNCTION devolver_stock_seguro(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order  orders%ROWTYPE;
  v_item   order_items%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF NOT v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock no había sido descontado');
  END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    PERFORM _devolver_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
  END LOOP;

  UPDATE orders SET stock_descontado = FALSE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock restaurado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- REEMPLAZO: reservar_stock_orden_manual — variant-aware
-- ============================================================
CREATE OR REPLACE FUNCTION reservar_stock_orden_manual(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order     orders%ROWTYPE;
  v_item      order_items%ROWTYPE;
  v_stock     INT;
  v_result    JSONB;
  v_faltantes JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya reservado para este pedido');
  END IF;

  -- Primera pasada: verificar stock suficiente (producto o variante)
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT stock_unidades INTO v_stock FROM product_variants WHERE id = v_item.variant_id FOR UPDATE;
    ELSE
      SELECT stock_unidades INTO v_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
    END IF;

    IF v_stock IS NULL OR v_stock < v_item.unidades THEN
      v_faltantes := v_faltantes || jsonb_build_object(
        'product_id', v_item.product_id,
        'variant_id', v_item.variant_id,
        'nombre',     v_item.nombre_snap || COALESCE(' (' || v_item.variant_snap || ')', ''),
        'disponible', COALESCE(v_stock, 0),
        'solicitado', v_item.unidades
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_faltantes) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Stock insuficiente al momento de confirmar el pedido',
      'faltantes', v_faltantes
    );
  END IF;

  -- Segunda pasada: descontar
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    v_result := _descontar_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock reservado para pago manual');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION _descontar_stock_item(UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION _devolver_stock_item(UUID, UUID, INT)  TO service_role;
GRANT EXECUTE ON FUNCTION descontar_stock_seguro(UUID)           TO service_role;
GRANT EXECUTE ON FUNCTION devolver_stock_seguro(UUID)            TO service_role;
GRANT EXECUTE ON FUNCTION reservar_stock_orden_manual(UUID)      TO service_role;

-- ============================================================
-- FEATURE: Canal exclusivo minorista (ocultar de catálogo mayorista)
-- ============================================================
-- Antes, venta_minorista solo agregaba la opción de compra por unidad
-- SIN ocultar el producto del catálogo mayorista (home). Con esta
-- columna, el admin puede desactivar venta_mayorista para que el
-- producto aparezca EXCLUSIVAMENTE en /minorista.
ALTER TABLE products ADD COLUMN IF NOT EXISTS venta_mayorista BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN products.venta_mayorista IS
  'Si es FALSE, el producto NO aparece en el catálogo mayorista (home/buscador) y se vende exclusivamente por unidad en /minorista.';

CREATE INDEX IF NOT EXISTS idx_products_venta_mayorista ON products(venta_mayorista) WHERE venta_mayorista = TRUE;

-- ============================================================
-- FEATURE: Packs Surtidos B2B ("curvas de producto")
-- ============================================================
-- Modelo de negocio:
--  - Minorista (B2C): el cliente elige talle+color exacto, precio full
--    (ya implementado — order_items.variant_id apunta a UNA variante)
--  - Mayorista (B2B): comprar "1 Docena" es un PACK CERRADO — el sistema
--    arma automáticamente una distribución aleatoria de talles/colores
--    tomando del MISMO pool de stock que usa minorista (no son stocks
--    separados), a precio con descuento por volumen (precio_docena/
--    precio_media_docena, ya definidos por el admin).
--
-- Un solo order_item de pack ahora puede tocar VARIAS variantes a la
-- vez, así que se guarda el desglose completo en curva_breakdown
-- (JSONB) — a diferencia de variant_id que solo referencia una.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS curva_breakdown JSONB;
COMMENT ON COLUMN order_items.curva_breakdown IS
  'Array [{variant_id, talla, color, cantidad}] — desglose de qué talles/colores exactos componen un pack surtido mayorista. NULL para items normales (sin variantes o minorista de variante única).';

-- ============================================================
-- FUNCTION: generar_curva_pack
-- Arma la distribución aleatoria de un pack (ej: 12 unidades)
-- repartidas entre las variantes con stock disponible. NO descuenta
-- nada (solo lectura + cálculo) — se llama al crear el pedido para
-- fijar la composición exacta, y el descuento real ocurre después
-- según el método de pago (igual que el resto del sistema).
-- ============================================================
CREATE OR REPLACE FUNCTION generar_curva_pack(p_product_id UUID, p_unidades INT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_variant       RECORD;
  v_total_stock   INT := 0;
  v_restantes     INT := p_unidades;
  v_breakdown     JSONB := '[]'::JSONB;
  v_tomar         INT;
BEGIN
  -- Stock total disponible entre todas las variantes activas del producto
  SELECT COALESCE(SUM(stock_unidades), 0) INTO v_total_stock
    FROM product_variants
    WHERE product_id = p_product_id AND activo = TRUE AND stock_unidades > 0;

  IF v_total_stock < p_unidades THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Stock insuficiente para armar el pack — solo hay ' || v_total_stock || ' unidades disponibles entre todas las variantes'
    );
  END IF;

  -- Reparto ponderado y aleatorizado: recorremos las variantes en orden
  -- aleatorio, tomando de cada una una porción proporcional a su stock
  -- disponible (con algo de aleatoriedad extra), hasta completar el pack.
  FOR v_variant IN
    SELECT id, talla, color, stock_unidades
      FROM product_variants
      WHERE product_id = p_product_id AND activo = TRUE AND stock_unidades > 0
      ORDER BY random()
  LOOP
    EXIT WHEN v_restantes <= 0;

    -- Tomar una cantidad aleatoria de esta variante: entre 1 y su stock
    -- disponible, sin pasarse de lo que falta para completar el pack.
    v_tomar := LEAST(
      v_restantes,
      v_variant.stock_unidades,
      GREATEST(1, floor(random() * v_variant.stock_unidades + 1))::INT
    );

    v_breakdown := v_breakdown || jsonb_build_object(
      'variant_id', v_variant.id,
      'talla',      v_variant.talla,
      'color',      v_variant.color,
      'cantidad',   v_tomar
    );
    v_restantes := v_restantes - v_tomar;
  END LOOP;

  -- Si por el redondeo del reparto aleatorio quedó algo sin asignar,
  -- completar tomando más de las variantes ya incluidas con stock sobrante.
  IF v_restantes > 0 THEN
    FOR v_variant IN
      SELECT id, talla, color, stock_unidades
        FROM product_variants
        WHERE product_id = p_product_id AND activo = TRUE AND stock_unidades > 0
        ORDER BY random()
    LOOP
      EXIT WHEN v_restantes <= 0;
      DECLARE
        v_ya_asignado INT := COALESCE((
          SELECT SUM((elem->>'cantidad')::INT)
          FROM jsonb_array_elements(v_breakdown) elem
          WHERE elem->>'variant_id' = v_variant.id::TEXT
        ), 0);
        v_disponible INT := v_variant.stock_unidades - v_ya_asignado;
        v_extra INT;
      BEGIN
        IF v_disponible > 0 THEN
          v_extra := LEAST(v_restantes, v_disponible);
          -- Sumar al elemento existente si ya estaba en el breakdown
          IF v_ya_asignado > 0 THEN
            v_breakdown := (
              SELECT jsonb_agg(
                CASE WHEN elem->>'variant_id' = v_variant.id::TEXT
                  THEN jsonb_set(elem, '{cantidad}', to_jsonb((elem->>'cantidad')::INT + v_extra))
                  ELSE elem
                END
              )
              FROM jsonb_array_elements(v_breakdown) elem
            );
          ELSE
            v_breakdown := v_breakdown || jsonb_build_object(
              'variant_id', v_variant.id, 'talla', v_variant.talla,
              'color', v_variant.color, 'cantidad', v_extra
            );
          END IF;
          v_restantes := v_restantes - v_extra;
        END IF;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'breakdown', v_breakdown);
END;
$$;

-- ============================================================
-- Helpers: descontar/devolver stock de un breakdown completo
-- (varias variantes a la vez, cada una con su propio lock)
-- ============================================================
CREATE OR REPLACE FUNCTION _descontar_stock_curva(p_breakdown JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_elem  JSONB;
  v_stock INT;
  v_faltantes JSONB := '[]'::JSONB;
BEGIN
  -- Primera pasada: verificar stock de TODAS las variantes del breakdown
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_breakdown) LOOP
    SELECT stock_unidades INTO v_stock
      FROM product_variants WHERE id = (v_elem->>'variant_id')::UUID FOR UPDATE;
    IF v_stock IS NULL OR v_stock < (v_elem->>'cantidad')::INT THEN
      v_faltantes := v_faltantes || jsonb_build_object(
        'variant_id', v_elem->>'variant_id',
        'disponible', COALESCE(v_stock, 0),
        'requerido',  (v_elem->>'cantidad')::INT
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_faltantes) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'faltantes', v_faltantes);
  END IF;

  -- Segunda pasada: descontar (ya garantizado que alcanza)
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_breakdown) LOOP
    UPDATE product_variants
      SET stock_unidades = stock_unidades - (v_elem->>'cantidad')::INT, updated_at = NOW()
      WHERE id = (v_elem->>'variant_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION _devolver_stock_curva(p_breakdown JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_elem JSONB;
BEGIN
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_breakdown) LOOP
    UPDATE product_variants
      SET stock_unidades = stock_unidades + (v_elem->>'cantidad')::INT, updated_at = NOW()
      WHERE id = (v_elem->>'variant_id')::UUID;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION generar_curva_pack(UUID, INT)   TO service_role;
GRANT EXECUTE ON FUNCTION _descontar_stock_curva(JSONB)   TO service_role;
GRANT EXECUTE ON FUNCTION _devolver_stock_curva(JSONB)    TO service_role;

-- ============================================================
-- REEMPLAZO FINAL: descontar_stock_seguro — ahora también
-- soporta curva_breakdown (packs surtidos mayoristas B2B)
-- ============================================================
CREATE OR REPLACE FUNCTION descontar_stock_seguro(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order   orders%ROWTYPE;
  v_item    order_items%ROWTYPE;
  v_stock   INT;
  v_errors  TEXT[] := '{}';
  v_curva_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya descontado');
  END IF;

  -- Verificación: pack surtido (curva), variante única, o producto plano
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      -- La disponibilidad de un pack surtido se valida elemento por
      -- elemento dentro de _descontar_stock_curva (segunda pasada abajo)
      CONTINUE;
    ELSIF v_item.variant_id IS NOT NULL THEN
      SELECT stock_unidades INTO v_stock FROM product_variants WHERE id = v_item.variant_id FOR UPDATE;
    ELSE
      SELECT stock_unidades INTO v_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
    END IF;

    IF v_item.curva_breakdown IS NULL AND (v_stock IS NULL OR v_stock < v_item.unidades) THEN
      v_errors := array_append(v_errors,
        'Stock insuficiente para "' || v_item.nombre_snap ||
        COALESCE(' (' || v_item.variant_snap || ')', '') ||
        '": disponible=' || COALESCE(v_stock, 0)::TEXT || ', requerido=' || v_item.unidades::TEXT
      );
    END IF;
  END LOOP;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', to_jsonb(v_errors));
  END IF;

  -- Descuento real
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      v_curva_result := _descontar_stock_curva(v_item.curva_breakdown);
      IF NOT (v_curva_result->>'ok')::BOOLEAN THEN
        RETURN jsonb_build_object('success', false, 'errors',
          jsonb_build_array('Stock insuficiente para completar el pack surtido de "' || v_item.nombre_snap || '"'));
      END IF;
    ELSE
      PERFORM _descontar_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
    END IF;
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock descontado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- REEMPLAZO FINAL: devolver_stock_seguro — con soporte de curva
-- ============================================================
CREATE OR REPLACE FUNCTION devolver_stock_seguro(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order  orders%ROWTYPE;
  v_item   order_items%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF NOT v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock no había sido descontado');
  END IF;

  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      PERFORM _devolver_stock_curva(v_item.curva_breakdown);
    ELSE
      PERFORM _devolver_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
    END IF;
  END LOOP;

  UPDATE orders SET stock_descontado = FALSE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock restaurado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- REEMPLAZO FINAL: reservar_stock_orden_manual — con curva
-- ============================================================
CREATE OR REPLACE FUNCTION reservar_stock_orden_manual(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order     orders%ROWTYPE;
  v_item      order_items%ROWTYPE;
  v_stock     INT;
  v_faltantes JSONB := '[]'::JSONB;
  v_curva_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya reservado para este pedido');
  END IF;

  -- Verificación (los packs surtidos se validan en la segunda pasada)
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      CONTINUE;
    END IF;

    IF v_item.variant_id IS NOT NULL THEN
      SELECT stock_unidades INTO v_stock FROM product_variants WHERE id = v_item.variant_id FOR UPDATE;
    ELSE
      SELECT stock_unidades INTO v_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
    END IF;

    IF v_stock IS NULL OR v_stock < v_item.unidades THEN
      v_faltantes := v_faltantes || jsonb_build_object(
        'product_id', v_item.product_id,
        'variant_id', v_item.variant_id,
        'nombre',     v_item.nombre_snap || COALESCE(' (' || v_item.variant_snap || ')', ''),
        'disponible', COALESCE(v_stock, 0),
        'solicitado', v_item.unidades
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_faltantes) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Stock insuficiente al momento de confirmar el pedido',
      'faltantes', v_faltantes
    );
  END IF;

  -- Descuento real (incluye packs surtidos)
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      v_curva_result := _descontar_stock_curva(v_item.curva_breakdown);
      IF NOT (v_curva_result->>'ok')::BOOLEAN THEN
        RETURN jsonb_build_object('success', false,
          'error', 'Stock insuficiente para completar el pack surtido de "' || v_item.nombre_snap || '"');
      END IF;
    ELSE
      PERFORM _descontar_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
    END IF;
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock reservado para pago manual');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN — Solo venta mayorista (docena obligatoria, media docena
-- opcional). Se desactiva el canal minorista (compra por unidad) sin
-- borrar los datos existentes, por si se reactiva en el futuro.
-- ══════════════════════════════════════════════════════════════════════

-- precio_media_docena pasa a ser opcional: habrá productos que solo se
-- vendan por docena completa o por curva/pack surtido.
ALTER TABLE products ALTER COLUMN precio_media_docena DROP NOT NULL;
ALTER TABLE products ALTER COLUMN precio_media_docena DROP DEFAULT;

-- Se desactiva la venta minorista para todos los productos existentes.
-- No se borra la columna ni los datos (precio_unitario, stock_minorista_*
-- quedan intactos en la tabla) para poder reactivarlo más adelante.
UPDATE products SET venta_minorista = FALSE, venta_mayorista = TRUE;

-- ══════════════════════════════════════════════════════════════════════
-- FEATURE 1 — Precio escalonado por volumen (quiebre de precio)
-- ══════════════════════════════════════════════════════════════════════
-- precio_tiers: array de escalones [{ "min_docenas": 5, "precio_docena": 9000 }, ...]
-- ordenado ascendente por min_docenas. Al comprar N docenas, se aplica el
-- precio del escalón más alto cuyo min_docenas <= N. Si no hay escalón
-- aplicable (compra menor al primer escalón), se usa products.precio_docena
-- normal. No aplica a media docena ni a compra por unidad (minorista).
ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN products.precio_tiers IS
  'Escalones de precio por volumen: [{"min_docenas":N,"precio_docena":P}]. Ordenado ascendente por min_docenas.';

-- ══════════════════════════════════════════════════════════════════════
-- FEATURE 3 — Pedido mínimo por cliente recurrente / cuenta corriente simple
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS clientes_mayoristas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  monto_minimo_pedido NUMERIC(10,2),          -- NULL = usa el mínimo general del sitio
  descuento_fijo_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_fijo_pct >= 0 AND descuento_fijo_pct <= 100),
  limite_cuenta_corriente NUMERIC(10,2) NOT NULL DEFAULT 0, -- 0 = sin cuenta corriente habilitada
  saldo_cuenta_corriente  NUMERIC(10,2) NOT NULL DEFAULT 0, -- deuda actual del cliente (positivo = debe)
  notas               TEXT,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_mayoristas_profile ON clientes_mayoristas(profile_id);

ALTER TABLE clientes_mayoristas ENABLE ROW LEVEL SECURITY;

-- El cliente puede ver sus propias condiciones (para mostrarle su descuento/saldo)
CREATE POLICY "cliente_ve_su_condicion" ON clientes_mayoristas
  FOR SELECT USING (auth.uid() = profile_id);

-- Solo admin gestiona (INSERT/UPDATE/DELETE) — se hace vía API con service_role,
-- pero se deja la policy explícita por si se consulta directo con RLS activo.
CREATE POLICY "admin_gestiona_clientes_mayoristas" ON clientes_mayoristas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Monto mínimo de compra general del sitio (aplica a quien no tenga
-- condición particular en clientes_mayoristas).
INSERT INTO site_settings (clave, valor, descripcion)
VALUES ('monto_minimo_pedido', '0', 'Monto mínimo de compra mayorista general (0 = sin mínimo). Se puede sobrescribir por cliente en clientes_mayoristas.')
ON CONFLICT (clave) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- FEATURE 4 — Alertas de quiebre de stock por variante (talle/color)
-- ══════════════════════════════════════════════════════════════════════
-- Evita mandar la misma alerta de "variante agotada" repetidas veces
-- mientras siga en 0 — se resetea solo cuando vuelve a tener stock.
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS alerta_quiebre_enviada BOOLEAN NOT NULL DEFAULT FALSE;

-- ── TRIGGER: notificar_quiebre_variante ──────────────────────────────
-- Cuando el stock de una variante cae a 0 (y no se había avisado todavía),
-- inserta un registro en notificaciones_admin. El envío real del push se
-- hace desde la app (no se puede hacer HTTP fetch directo desde Postgres
-- sin extensiones adicionales) — un cron liviano barre estos registros
-- pendientes cada pocos minutos y dispara el push. Ver
-- /api/cron/stock-alerts/route.ts.
CREATE OR REPLACE FUNCTION _marcar_quiebre_variante()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock_unidades = 0 AND OLD.stock_unidades > 0 AND NOT NEW.alerta_quiebre_enviada THEN
    INSERT INTO notificaciones_admin (tipo, evento, order_id, enviado, error)
    VALUES ('push', 'variante_quiebre_stock', NULL, FALSE, NEW.product_id || '|' || NEW.id || '|' || NEW.talla || '|' || NEW.color);
    NEW.alerta_quiebre_enviada := TRUE;
  ELSIF NEW.stock_unidades > 0 AND OLD.stock_unidades = 0 THEN
    -- Volvió a tener stock: se resetea para poder alertar de nuevo si vuelve a agotarse
    NEW.alerta_quiebre_enviada := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiebre_variante ON product_variants;
CREATE TRIGGER trg_quiebre_variante
  BEFORE UPDATE OF stock_unidades ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION _marcar_quiebre_variante();

-- Se habilita 'cuenta_corriente' como método de pago — solo disponible
-- para clientes con condición cargada en clientes_mayoristas y límite > 0.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_metodo_pago_check;
ALTER TABLE orders ADD CONSTRAINT orders_metodo_pago_check
  CHECK (metodo_pago IN ('mercadopago','transferencia','cuenta_corriente'));

-- ── RPC: sumar_saldo_cuenta_corriente ────────────────────────────────
-- Suma `p_monto` al saldo (deuda) del cliente con locking para evitar
-- condiciones de carrera si compra dos veces casi al mismo tiempo.
CREATE OR REPLACE FUNCTION sumar_saldo_cuenta_corriente(p_profile_id UUID, p_monto NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE clientes_mayoristas
  SET saldo_cuenta_corriente = saldo_cuenta_corriente + p_monto,
      updated_at = NOW()
  WHERE profile_id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente mayorista % no encontrado', p_profile_id;
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- ÍNDICES DE OPTIMIZACIÓN — Catálogo, historial de pedidos, y relaciones
-- de variantes/stock. Auditado contra los índices ya existentes en este
-- archivo para no duplicar nada — todos usan IF NOT EXISTS, seguros de
-- correr las veces que hagan falta.
-- ══════════════════════════════════════════════════════════════════════

-- 1) CATÁLOGO Y PEDIDO RÁPIDO
-- Cubre el patrón real de consulta: productos activos + mayoristas,
-- ordenados por nombre (usado en /, /pedido-rapido y la lista de precios
-- PDF). Índice parcial: solo indexa las filas que realmente se listan.
CREATE INDEX IF NOT EXISTS idx_products_catalogo_activo
  ON products (activo, venta_mayorista, nombre)
  WHERE activo = TRUE AND venta_mayorista = TRUE;

-- Acelera el buscador (ilike '%término%' sobre nombre). pg_trgm suele
-- venir habilitada en Supabase por defecto.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_nombre_trgm
  ON products USING GIN (nombre gin_trgm_ops);

-- 2) HISTORIAL DE PEDIDOS Y REÓRDENES (perfil del comerciante)
-- user_id + orden cronológico: evita un sort en memoria después de
-- filtrar por cliente en /mis-pedidos.
CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON orders (user_id, created_at DESC);

-- user_id + estado: filtros tipo "mis pedidos pendientes" sin escanear
-- todo el historial del cliente.
CREATE INDEX IF NOT EXISTS idx_orders_user_estado
  ON orders (user_id, estado);

-- 3) RELACIONES DE VARIANTES/STOCK EN LOTE
-- Hueco real encontrado en la auditoría: la FK order_items.product_id no
-- tenía índice. La necesitan "Repetir pedido", el futuro reporte de
-- reposición por producto, y cualquier analítica de ventas históricas
-- por producto.
CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON order_items (product_id);

-- ══════════════════════════════════════════════════════════════════════
-- Nombre real de la tienda: CM Importados. Este UPDATE es un respaldo
-- por si el schema ya se había corrido antes con el placeholder
-- 'Mi Tienda' — el INSERT de arriba usa ON CONFLICT DO NOTHING, así que
-- no pisa un valor ya existente. Este UPDATE sí lo corrige, pero solo si
-- el valor sigue siendo el placeholder original (no toca nada si el
-- admin ya lo personalizó distinto desde /admin/configuracion).
-- ══════════════════════════════════════════════════════════════════════
UPDATE site_settings SET valor = 'CM Importados'
  WHERE clave = 'nombre_tienda' AND valor = 'Mi Tienda';

UPDATE site_settings SET valor = 'Venta mayorista de indumentaria importada — packs por docena y curva surtida'
  WHERE clave = 'descripcion_tienda' AND valor = 'La mejor tienda online';

-- ══════════════════════════════════════════════════════════════════════
-- Se elimina la calculadora automática de envío por código postal — el
-- envío ahora se coordina manualmente (WhatsApp, chat en vivo, contacto
-- personal). Se borra la tabla shipping_zones y todo lo que dependa de
-- ella; ya no queda ningún endpoint ni pantalla de admin que la use
-- (se sacaron /admin/zonas, /api/shipping y /api/admin/shipping-zones).
-- ✅ FIX: este bloque estaba duplicado más abajo — la segunda copia
-- hacía DROP POLICY sobre una tabla que la primera copia ya había
-- borrado, y Postgres no perdona eso ni con IF EXISTS (el IF EXISTS
-- solo cubre "la policy no existe", no "la tabla no existe"). Con
-- CASCADE alcanza un solo DROP TABLE: se lleva puestas las policies
-- solo, sin necesidad de borrarlas antes a mano, y es seguro de
-- correr las veces que sea (si la tabla ya no existe, no hace nada).
-- ══════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS shipping_zones CASCADE;

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION: Verificación de identidad para retiro en local
-- ══════════════════════════════════════════════════════════════════════
-- Agrega los datos necesarios para validar, en el local, que quien
-- retira el pedido es efectivamente el titular de la compra (o la
-- persona que el titular autorizó). Junto con codigo_retiro (ya
-- existente), esto arma la verificación de dos factores: código +
-- documento.
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS retiro_dni_titular    TEXT,
  ADD COLUMN IF NOT EXISTS retiro_retira_tercero BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retiro_tercero_nombre TEXT,
  ADD COLUMN IF NOT EXISTS retiro_tercero_dni    TEXT,
  ADD COLUMN IF NOT EXISTS retirado_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retirado_por          UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN orders.retiro_dni_titular    IS 'DNI/documento del cliente que compró, para validar en el local';
COMMENT ON COLUMN orders.retiro_retira_tercero IS 'TRUE si el titular indicó que retira otra persona (no él mismo)';
COMMENT ON COLUMN orders.retiro_tercero_nombre IS 'Nombre completo de la persona autorizada a retirar, si no es el titular';
COMMENT ON COLUMN orders.retiro_tercero_dni    IS 'DNI de la persona autorizada a retirar, si no es el titular';
COMMENT ON COLUMN orders.retirado_at           IS 'Momento en que el pedido fue efectivamente retirado del local (verificado por un admin)';
COMMENT ON COLUMN orders.retirado_por           IS 'Admin/empleado que verificó el código + DNI y entregó el pedido';

CREATE INDEX IF NOT EXISTS idx_orders_retiro_dni_titular ON orders(retiro_dni_titular);

-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION: Estado de cuenta — historial de movimientos (cuenta corriente)
-- ══════════════════════════════════════════════════════════════════════
-- Hasta ahora `saldo_cuenta_corriente` era un número que subía/bajaba sin
-- dejar rastro de qué lo movió. Esta tabla guarda cada cargo (compra) y
-- pago (cliente cancela deuda) para poder mostrarle al cliente un
-- historial real, y al admin una auditoría de movimientos.
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS movimientos_cuenta_corriente (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL CHECK (tipo IN ('cargo', 'pago', 'ajuste')),
  monto             NUMERIC(10,2) NOT NULL,
  saldo_resultante  NUMERIC(10,2) NOT NULL,
  concepto          TEXT,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  registrado_por    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_cc_profile ON movimientos_cuenta_corriente(profile_id, created_at DESC);

ALTER TABLE movimientos_cuenta_corriente ENABLE ROW LEVEL SECURITY;

-- El cliente ve su propio historial (para el estado de cuenta en /perfil)
CREATE POLICY "cliente_ve_sus_movimientos" ON movimientos_cuenta_corriente
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "admin_gestiona_movimientos_cc" ON movimientos_cuenta_corriente
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- ── RPC: sumar_saldo_cuenta_corriente (ampliado) ────────────────────────
-- Se elimina la versión vieja de 2 parámetros para evitar ambigüedad de
-- sobrecarga (Postgres no puede resolver cuál usar si conviven dos
-- versiones con parámetros opcionales que se solapan). La nueva versión
-- hace lo mismo que antes + deja registrado el movimiento tipo 'cargo'
-- en el mismo paso atómico.
DROP FUNCTION IF EXISTS sumar_saldo_cuenta_corriente(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION sumar_saldo_cuenta_corriente(
  p_profile_id UUID,
  p_monto      NUMERIC,
  p_order_id   UUID DEFAULT NULL,
  p_concepto   TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_nuevo_saldo NUMERIC;
BEGIN
  UPDATE clientes_mayoristas
  SET saldo_cuenta_corriente = saldo_cuenta_corriente + p_monto,
      updated_at = NOW()
  WHERE profile_id = p_profile_id
  RETURNING saldo_cuenta_corriente INTO v_nuevo_saldo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente mayorista % no encontrado', p_profile_id;
  END IF;

  INSERT INTO movimientos_cuenta_corriente (profile_id, tipo, monto, saldo_resultante, concepto, order_id)
  VALUES (p_profile_id, 'cargo', p_monto, v_nuevo_saldo, COALESCE(p_concepto, 'Compra por cuenta corriente'), p_order_id);

  RETURN v_nuevo_saldo;
END;
$$;

-- ── RPC: registrar_pago_cuenta_corriente (nuevo) ────────────────────────
-- Usado desde el admin cuando el cliente cancela (total o parcialmente)
-- su deuda. Resta del saldo de forma atómica (evita condiciones de
-- carrera si se registran dos pagos casi al mismo tiempo) y deja
-- constancia de quién lo cargó.
CREATE OR REPLACE FUNCTION registrar_pago_cuenta_corriente(
  p_profile_id UUID,
  p_monto      NUMERIC,
  p_admin_id   UUID DEFAULT NULL,
  p_concepto   TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_nuevo_saldo NUMERIC;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a cero';
  END IF;

  UPDATE clientes_mayoristas
  SET saldo_cuenta_corriente = GREATEST(0, saldo_cuenta_corriente - p_monto),
      updated_at = NOW()
  WHERE profile_id = p_profile_id
  RETURNING saldo_cuenta_corriente INTO v_nuevo_saldo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente mayorista % no encontrado', p_profile_id;
  END IF;

  INSERT INTO movimientos_cuenta_corriente (profile_id, tipo, monto, saldo_resultante, concepto, registrado_por)
  VALUES (p_profile_id, 'pago', p_monto, v_nuevo_saldo, COALESCE(p_concepto, 'Pago registrado por administración'), p_admin_id);

  RETURN v_nuevo_saldo;
END;
$$;

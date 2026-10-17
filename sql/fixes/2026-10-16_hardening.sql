-- ══════════════════════════════════════════════════════════════════════
-- HARDENING 2026-10-16 — seguridad + consistencia de stock
-- Correr UNA vez en Supabase → SQL Editor → Run. Es idempotente
-- (seguro de re-correr). No toca tablas ni datos.
--
-- Contenido:
--   1. Reemplazo de descontar_stock_seguro / reservar_stock_orden_manual:
--      rollback real si falla un item (antes quedaban descuentos parciales).
--   2. Trigger anti-escalada de rol: ahora permite al SQL Editor/postgres.
--   3. orders / order_items: se eliminan las policies de INSERT desde cliente
--      (los pedidos se crean solo desde el backend con service role).
--   4. Bucket "comprobantes": MIME correcto para PDF.
--   5. REVOKE de EXECUTE en funciones internas (solo service_role) y
--      search_path fijo en todas las SECURITY DEFINER.
--
-- Va en este orden a propósito: las funciones se redefinen ANTES del
-- REVOKE/ALTER final para que los permisos queden bien al terminar.
-- ══════════════════════════════════════════════════════════════════════


-- ── 1a. descontar_stock_seguro (Mercado Pago, webhook approved) ───────
CREATE OR REPLACE FUNCTION descontar_stock_seguro(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        orders%ROWTYPE;
  v_item         order_items%ROWTYPE;
  v_stock        INT;
  v_errors       TEXT[] := '{}';
  v_curva_result JSONB;
  v_item_result  JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya descontado');
  END IF;

  -- Verificación: variante única o producto plano (los packs surtidos se
  -- validan dentro de _descontar_stock_curva).
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      CONTINUE;
    ELSIF v_item.variant_id IS NOT NULL THEN
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

  -- Descuento real. Cualquier falla acá hace RAISE EXCEPTION: el bloque
  -- EXCEPTION de abajo revierte TODO lo descontado hasta ese punto.
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      v_curva_result := _descontar_stock_curva(v_item.curva_breakdown);
      IF NOT (v_curva_result->>'ok')::BOOLEAN THEN
        RAISE EXCEPTION 'Stock insuficiente para completar el pack surtido de "%"', v_item.nombre_snap;
      END IF;
    ELSE
      v_item_result := _descontar_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
      IF NOT (v_item_result->>'ok')::BOOLEAN THEN
        RAISE EXCEPTION 'Stock insuficiente para "%"', v_item.nombre_snap;
      END IF;
    END IF;
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock descontado correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ── 1b. reservar_stock_orden_manual (transferencia / efectivo / cta cte) ──
CREATE OR REPLACE FUNCTION reservar_stock_orden_manual(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order        orders%ROWTYPE;
  v_item         order_items%ROWTYPE;
  v_stock        INT;
  v_faltantes    JSONB := '[]'::JSONB;
  v_curva_result JSONB;
  v_item_result  JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.stock_descontado THEN
    RETURN jsonb_build_object('success', true, 'message', 'Stock ya reservado para este pedido');
  END IF;

  -- Verificación (los packs surtidos se validan en _descontar_stock_curva)
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

  -- Descuento real: RAISE EXCEPTION => rollback completo (ver bloque EXCEPTION).
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.curva_breakdown IS NOT NULL THEN
      v_curva_result := _descontar_stock_curva(v_item.curva_breakdown);
      IF NOT (v_curva_result->>'ok')::BOOLEAN THEN
        RAISE EXCEPTION 'Stock insuficiente para completar el pack surtido de "%"', v_item.nombre_snap;
      END IF;
    ELSE
      v_item_result := _descontar_stock_item(v_item.variant_id, v_item.product_id, v_item.unidades);
      IF NOT (v_item_result->>'ok')::BOOLEAN THEN
        RAISE EXCEPTION 'Stock insuficiente para "%"', v_item.nombre_snap;
      END IF;
    END IF;
  END LOOP;

  UPDATE orders SET stock_descontado = TRUE, updated_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Stock reservado para pago manual');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ── 2. Trigger anti-escalada de rol ───────────────────────────────────
-- Igual que antes, pero ahora el SQL Editor (current_user = postgres /
-- supabase_admin) y el backend (service_role) pueden cambiar roles.
-- Un usuario logueado normal ('authenticated') sigue bloqueado.
CREATE OR REPLACE FUNCTION _prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rol IS NOT DISTINCT FROM OLD.rol THEN
    RETURN NEW;
  END IF;

  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR auth.role() = 'service_role'
     OR is_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'No autorizado para modificar el rol de usuario';
END;
$$;

-- Se (re)crea el trigger por si en tu base nunca se había adjuntado.
DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION _prevent_role_self_escalation();


-- ── 3. orders / order_items: sin INSERT desde el cliente ──────────────
-- /api/orders crea pedidos con createAdminClient() (service role, que
-- ignora RLS). La policy vieja ("user_id = auth.uid() OR auth.uid() IS
-- NOT NULL") dejaba a cualquier usuario logueado insertar pedidos por
-- PostgREST con el estado/total que quisiera (incluso 'entregado', lo
-- que habilitaba reseñas "verificadas" falsas). Sin policy de INSERT,
-- RLS lo bloquea por defecto.
DROP POLICY IF EXISTS "orders_insert_auth"  ON orders;
DROP POLICY IF EXISTS "order_items_insert"  ON order_items;


-- ── 4. Bucket "comprobantes": 'image/pdf' no existe → application/pdf ──
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf']
 WHERE id = 'comprobantes';


-- ── 5. Permisos de ejecución + search_path ────────────────────────────
-- Postgres da EXECUTE a PUBLIC por defecto y Supabase además lo da
-- explícito a anon/authenticated: hay que revocar de los tres. Se hace
-- sobre TODAS las sobrecargas por nombre (sin depender de la firma) y
-- se ignora lo que no exista en tu base.
-- NO se toca is_admin(), search_products() ni los triggers: las policies
-- RLS y el buscador público las necesitan ejecutables.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'descontar_stock_seguro', 'devolver_stock_seguro',
        'reservar_stock_orden_manual', 'descontar_stock_solo',
        '_descontar_stock_item', '_devolver_stock_item',
        '_descontar_stock_curva', '_devolver_stock_curva',
        'generar_curva_pack',
        'sumar_saldo_cuenta_corriente', 'registrar_pago_cuenta_corriente',
        'reservar_stock_carrito', 'liberar_reserva_carrito'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- search_path fijo en las SECURITY DEFINER que lo tenían sin definir
-- (descontar_stock_solo, devolver_stock_seguro, las de carrito, is_admin).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        'devolver_stock_seguro', 'descontar_stock_solo',
        'reservar_stock_carrito', 'liberar_reserva_carrito', 'is_admin'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;
-- ════════════════════════════════════════════════════════════════════
--  orders / order_items: asegurar que NO exista INSERT desde el cliente
--
--  /api/orders crea los pedidos con el service role (ignora RLS), así que
--  ninguna policy de INSERT es necesaria. Este script es idempotente y no
--  modifica datos: se puede correr las veces que haga falta en el SQL
--  Editor de Supabase.
-- ════════════════════════════════════════════════════════════════════

-- 1) Quitar las policies viejas si todavía existieran en tu base
DROP POLICY IF EXISTS "orders_insert_auth" ON orders;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;

-- 2) Verificación: debería listar solo SELECT (y UPDATE en orders).
--    Si aparece alguna fila con cmd = 'INSERT' o 'ALL', hay que revisarla.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'order_items')
ORDER BY tablename, cmd, policyname;
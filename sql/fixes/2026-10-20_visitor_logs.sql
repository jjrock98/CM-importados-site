-- ============================================================================
-- Registro de visitas (IP + fecha/hora + página)  —  2026-10-20
-- Ejecutar UNA vez en Supabase → SQL Editor. Es idempotente.
--
-- Diseño de seguridad (mismo criterio que el resto del schema):
--   * RLS activado y SIN policy de INSERT/UPDATE/DELETE: nadie con la anon key
--     ni con una sesión de usuario puede escribir ni borrar. Solo el backend
--     (service_role, vía /api/visit) inserta, y service_role se saltea RLS.
--   * Lectura: solo admin, con el helper is_admin() que ya existe.
--   * Se guarda solo lo pedido: ip, path (sin query string) y created_at.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_logs (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip         INET        NOT NULL,
  path       TEXT        NOT NULL CHECK (char_length(path) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visitor_logs_created_at_idx ON public.visitor_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_logs_ip_idx         ON public.visitor_logs (ip, created_at DESC);

ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;

-- Cortar cualquier permiso por defecto a los roles públicos y devolver solo
-- el SELECT que necesita la policy de admin.
REVOKE ALL ON public.visitor_logs FROM anon, authenticated;
GRANT SELECT ON public.visitor_logs TO authenticated;

DROP POLICY IF EXISTS "visitor_logs_admin_select" ON public.visitor_logs;
CREATE POLICY "visitor_logs_admin_select" ON public.visitor_logs
  FOR SELECT TO authenticated USING (is_admin());

-- ── Consultas útiles (correr en el SQL Editor) ──────────────────────────────
-- Últimas 100 visitas:
--   SELECT created_at, ip, path FROM visitor_logs ORDER BY created_at DESC LIMIT 100;
-- Visitas por página, últimos 7 días:
--   SELECT path, COUNT(*) FROM visitor_logs
--   WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY path ORDER BY 2 DESC;
-- IPs más activas (posible abuso):
--   SELECT ip, COUNT(*) FROM visitor_logs
--   WHERE created_at > NOW() - INTERVAL '1 day' GROUP BY ip ORDER BY 2 DESC LIMIT 20;

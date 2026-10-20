import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { secretsMatch } from '@/lib/secureCompare';

// Cuántos días se conservan las IP. No guardar datos personales más tiempo
// del necesario; ajustar acá si se quiere más/menos.
const RETENTION_DAYS = 90;

/**
 * Borra los registros de visitas más viejos que RETENTION_DAYS.
 * Corre diario por Vercel Cron (ver vercel.json). Misma autenticación que
 * /api/revalidate: header `Authorization: Bearer <CRON_SECRET>` (lo manda
 * Vercel solo) o `?secret=` para uso manual.
 */
export async function GET(req: NextRequest) {
  const authHeader  = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const ok =
    secretsMatch(req.nextUrl.searchParams.get('secret'), process.env.REVALIDATE_SECRET_TOKEN) ||
    secretsMatch(bearerToken, process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await createAdminClient()
    .from('visitor_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (error) {
    console.error('[cleanup-visitor-logs]', error.message);
    return NextResponse.json({ error: 'No se pudo limpiar' }, { status: 500 });
  }
  return NextResponse.json({ deleted: count ?? 0, retentionDays: RETENTION_DAYS });
}

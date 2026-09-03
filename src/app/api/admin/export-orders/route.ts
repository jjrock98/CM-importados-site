import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/export-orders?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=todos
 *
 * Genera un CSV con todos los pedidos filtrados, listo para Excel/contador.
 * Solo accesible por admins.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single();
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const desde  = searchParams.get('desde');
  const hasta  = searchParams.get('hasta');
  const estado = searchParams.get('estado') ?? 'todos';
  const tipoVenta = searchParams.get('tipo_venta') ?? 'todos';

  const admin  = createAdminClient();
  let query = admin
    .from('orders')
    .select(`
      id, created_at, nombre, email, telefono,
      estado, metodo_pago, tipo_entrega, tipo_venta,
      subtotal, costo_envio, total,
      direccion, ciudad, codigo_postal,
      codigo_retiro, retiro_dni_titular, retiro_retira_tercero, retiro_tercero_nombre, retiro_tercero_dni, retirado_at,
      rejection_reason, notas,
      order_items(nombre_snap, tipo_pack, cantidad_packs, unidades, precio_unit, subtotal)
    `)
    .order('created_at', { ascending: false });

  if (estado !== 'todos')    query = query.eq('estado', estado);
  if (tipoVenta !== 'todos') query = query.eq('tipo_venta', tipoVenta);
  if (desde) query = query.gte('created_at', `${desde}T00:00:00`);
  if (hasta) query = query.lte('created_at', `${hasta}T23:59:59`);

  const { data: orders, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  // Cabecera CSV
  const headers = [
    'ID Pedido', 'Fecha', 'Hora', 'Cliente', 'Email', 'Teléfono',
    'Estado', 'Método de pago', 'Tipo entrega', 'Tipo venta',
    'Productos',
    'Subtotal (ARS)', 'Costo envío (ARS)', 'Total (ARS)',
    'Dirección', 'Ciudad', 'CP',
    'Código retiro', 'DNI titular', 'Retira tercero', 'Nombre tercero', 'DNI tercero', 'Retirado el',
    'Notas', 'Motivo rechazo',
  ];

  const rows = (orders ?? []).map((o) => {
    const fecha = new Date(o.created_at);
    const items = (o.order_items as Array<{
      nombre_snap: string; tipo_pack: string;
      cantidad_packs: number; unidades: number; precio_unit: number; subtotal: number;
    }> ?? [])
      .map((i) => `${i.nombre_snap} (${i.tipo_pack} ×${i.cantidad_packs} = ${i.unidades}uds)`)
      .join(' | ');

    return [
      o.id.slice(0, 8).toUpperCase(),
      fecha.toLocaleDateString('es-AR'),
      fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      o.nombre,
      o.email,
      o.telefono ?? '',
      o.estado,
      o.metodo_pago,
      o.tipo_entrega,
      (o as Record<string, unknown>).tipo_venta as string ?? 'mayorista',
      items,
      fmt(Number(o.subtotal)),
      fmt(Number(o.costo_envio)),
      fmt(Number(o.total)),
      o.direccion,
      o.ciudad,
      o.codigo_postal,
      (o as Record<string, unknown>).codigo_retiro as string ?? '',
      (o as Record<string, unknown>).retiro_dni_titular as string ?? '',
      (o as Record<string, unknown>).retiro_retira_tercero ? 'Sí' : 'No',
      (o as Record<string, unknown>).retiro_tercero_nombre as string ?? '',
      (o as Record<string, unknown>).retiro_tercero_dni as string ?? '',
      (o as Record<string, unknown>).retirado_at
        ? new Date((o as Record<string, unknown>).retirado_at as string).toLocaleString('es-AR')
        : '',
      o.notas ?? '',
      o.rejection_reason ?? '',
    ].map((cell) => {
      // Escapar comillas dobles y envolver en comillas si tiene comas o saltos de línea
      const str = String(cell ?? '').replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"')
        ? `"${str}"`
        : str;
    }).join(',');
  });

  // BOM para que Excel abra correctamente con caracteres especiales
  const bom  = '\uFEFF';
  const csv  = bom + [headers.join(','), ...rows].join('\n');
  const desde_label = desde ?? 'inicio';
  const hasta_label = hasta  ?? 'hoy';

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pedidos_${desde_label}_${hasta_label}.csv"`,
    },
  });
}

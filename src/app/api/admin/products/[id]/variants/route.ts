import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

/** GET — listar variantes de un producto (incluye inactivas, uso admin) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('product_variants')
    .select('*')
    .eq('product_id', id)
    .order('talla').order('color');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/** POST — crear una nueva variante (talla + color + stock) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);

  const talla = String(body?.talla ?? '').trim();
  const color = String(body?.color ?? '').trim();
  const stock = Number(body?.stock_unidades ?? 0);

  if (!talla || !color) {
    return NextResponse.json({ error: 'Talla y color son requeridos' }, { status: 422 });
  }
  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: 'Stock inválido' }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('product_variants')
    .insert({
      product_id:     id,
      talla,
      color,
      stock_unidades: stock,
      sku:            body?.sku || null,
      imagen_url:     body?.imagen_url || null,
    })
    .select()
    .single();

  if (error) {
    // Constraint UNIQUE(product_id, talla, color)
    const isDup = error.code === '23505';
    return NextResponse.json(
      { error: isDup ? 'Ya existe una variante con esa talla y color' : error.message },
      { status: isDup ? 409 : 500 }
    );
  }
  return NextResponse.json({ data });
}

/** PUT — actualizar stock/datos de una variante existente (id en el body) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params; // product_id, solo para validar pertenencia
  const body = await req.json().catch(() => null);
  const variantId = body?.id;
  if (!variantId) return NextResponse.json({ error: 'id de variante requerido' }, { status: 400 });

  const admin = createAdminClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.talla !== undefined)          update.talla = String(body.talla).trim();
  if (body.color !== undefined)          update.color = String(body.color).trim();
  if (body.stock_unidades !== undefined) update.stock_unidades = Number(body.stock_unidades);
  if (body.sku !== undefined)            update.sku = body.sku || null;
  if (body.imagen_url !== undefined)     update.imagen_url = body.imagen_url || null;
  if (body.activo !== undefined)         update.activo = Boolean(body.activo);

  const { data, error } = await admin
    .from('product_variants')
    .update(update)
    .eq('id', variantId)
    .eq('product_id', id) // seguridad: no permite editar variantes de otro producto
    .select()
    .single();

  if (error) {
    const isDup = error.code === '23505';
    return NextResponse.json(
      { error: isDup ? 'Ya existe una variante con esa talla y color' : error.message },
      { status: isDup ? 409 : 500 }
    );
  }
  return NextResponse.json({ data });
}

/** DELETE — eliminar una variante (id en query ?variantId=) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const variantId = req.nextUrl.searchParams.get('variantId');
  if (!variantId) return NextResponse.json({ error: 'variantId requerido' }, { status: 400 });

  const admin = createAdminClient();

  // Si la variante ya fue usada en algún pedido, no se borra (rompería
  // la trazabilidad histórica) — se desactiva en su lugar.
  const { count } = await admin
    .from('order_items')
    .select('*', { count: 'exact', head: true })
    .eq('variant_id', variantId);

  if (count && count > 0) {
    const { error } = await admin
      .from('product_variants')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', variantId).eq('product_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  const { error } = await admin
    .from('product_variants')
    .delete()
    .eq('id', variantId)
    .eq('product_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: true });
}

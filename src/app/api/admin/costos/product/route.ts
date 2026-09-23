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

/**
 * PUT /api/admin/costos/product
 * body: { product_id, costo_compra_docena, transporte_docena, empaque_docena, otros_docena, notas? }
 *
 * Upsert del costo por docena de un producto puntual. Todos los
 * montos se cargan y se guardan por docena (bulto), nunca por unidad
 * — es el mismo criterio en todo el módulo. No toca la tabla
 * `products` ni sus precios de venta.
 */
export async function PUT(req: NextRequest) {
  const adminUser = await verifyAdmin();
  if (!adminUser) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();
  const { product_id, costo_compra_docena, transporte_docena, empaque_docena, otros_docena, notas } = body ?? {};

  if (!product_id) {
    return NextResponse.json({ error: 'Falta product_id' }, { status: 400 });
  }

  const montos = { costo_compra_docena, transporte_docena, empaque_docena, otros_docena };
  for (const [campo, valor] of Object.entries(montos)) {
    if (valor !== undefined && (typeof valor !== 'number' || valor < 0 || Number.isNaN(valor))) {
      return NextResponse.json({ error: `${campo} debe ser un número mayor o igual a 0` }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('product_costs')
    .upsert(
      {
        product_id,
        costo_compra_docena: costo_compra_docena ?? 0,
        transporte_docena: transporte_docena ?? 0,
        empaque_docena: empaque_docena ?? 0,
        otros_docena: otros_docena ?? 0,
        notas: notas ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
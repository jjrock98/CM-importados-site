import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Require password confirmation (sent in body)
  const { confirmText } = await req.json().catch(() => ({}));
  if (confirmText !== 'ELIMINAR') {
    return NextResponse.json({ error: 'Confirmación incorrecta' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check no active orders (paid but not delivered)
  const { data: activeOrders } = await admin
    .from('orders')
    .select('id')
    .eq('user_id', user.id)
    .in('estado', ['pagado', 'procesando', 'enviado']);

  if (activeOrders && activeOrders.length > 0) {
    return NextResponse.json({
      error: `Tenés ${activeOrders.length} pedido${activeOrders.length > 1 ? 's' : ''} activo${activeOrders.length > 1 ? 's' : ''}. Esperá a que sean entregados antes de eliminar tu cuenta.`,
    }, { status: 409 });
  }

  // Anonymize orders (preserve history but remove personal data)
  await admin
    .from('orders')
    .update({
      user_id:  null,
      nombre:   '[Cuenta eliminada]',
      email:    '[eliminado]',
      telefono: null,
      notas:    null,
    })
    .eq('user_id', user.id);

  // Delete Supabase auth user (profile deleted by CASCADE)
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta. Intentá de nuevo.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

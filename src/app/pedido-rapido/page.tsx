import { createClient } from '@/lib/supabase/server';
import { QuickOrderTable } from '@/components/products/QuickOrderTable';
import type { Product } from '@/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pedido rápido',
  description: 'Cargá cantidades por producto y agregá todo al carrito de una vez.',
  robots: { index: false }, // vista operativa, no aporta valor de SEO propio
};

export const revalidate = 60;

/**
 * Vista alternativa al catálogo visual — pensada para el comerciante que
 * ya sabe qué productos quiere y solo necesita cargar cantidades rápido,
 * sin abrir modal por modal. Es una ruta separada (no reemplaza la home)
 * para no imponerle esta UI al resto de compradores que prefieren
 * navegar el catálogo visual normal.
 */
export default async function PedidoRapidoPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('activo', true)
    .eq('venta_mayorista', true)
    .order('nombre', { ascending: true });

  const list = (products ?? []) as Product[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Pedido rápido</h1>
        <p className="text-sm text-muted mt-1">
          Cargá la cantidad de packs de cada producto y agregalos todos al carrito con un solo clic.
        </p>
      </div>
      <QuickOrderTable products={list} />
    </div>
  );
}

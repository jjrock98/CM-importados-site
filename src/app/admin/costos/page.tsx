import { CostosClient } from '@/components/admin/CostosClient';
import { CalculadoraCostos } from '@/components/admin/CalculadoraCostos';

export const metadata = { title: 'Costos por Docena – Admin' };
export const revalidate = 0;

export default function AdminCostosPage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Calculadora de costos y rentabilidad</h1>
          <p className="text-sm text-muted mt-1">
            Todo por docena. Podés guardar simulaciones en el historial; nunca modifica productos, precios ni stock del catálogo.
          </p>
        </div>
        <CalculadoraCostos />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold">Análisis de Costos por Docena</h2>
          <p className="text-sm text-muted mt-1">
            Simulación interna de márgenes. No modifica los precios publicados en el catálogo.
          </p>
        </div>
        <CostosClient />
      </section>
    </div>
  );
}
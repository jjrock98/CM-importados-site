import { CostosClient } from '@/components/admin/CostosClient';

export const metadata = { title: 'Costos por Docena – Admin' };
export const revalidate = 0;

export default function AdminCostosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Análisis de Costos por Docena</h1>
        <p className="text-sm text-muted mt-1">
          Simulación interna de márgenes. No modifica los precios publicados en el catálogo.
        </p>
      </div>
      <CostosClient />
    </div>
  );
}
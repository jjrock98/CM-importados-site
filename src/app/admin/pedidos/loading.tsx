import { AdminTableSkeleton } from '@/components/common/Skeleton';

export default function AdminPedidosLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-8 w-56 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      <AdminTableSkeleton rows={8} />
    </div>
  );
}

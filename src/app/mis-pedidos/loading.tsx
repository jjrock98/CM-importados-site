import { OrderListSkeleton } from '@/components/common/Skeleton';

export default function PedidosLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 h-8 w-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      <OrderListSkeleton count={4} />
    </div>
  );
}

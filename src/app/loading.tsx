import { ProductGridSkeleton } from '@/components/common/Skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Hero skeleton */}
      <div className="mb-10 animate-pulse space-y-4">
        <div className="h-10 w-2/3 rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-5 w-1/2 rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
      <ProductGridSkeleton count={8} />
    </div>
  );
}

import { DashboardSkeleton } from '@/components/common/Skeleton';

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <DashboardSkeleton />
    </div>
  );
}

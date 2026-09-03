import { cn } from '@/utils';

// ── Átomo base ─────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800',
        className
      )}
    />
  );
}

// ── Product card skeleton ────────────────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Bone className="aspect-square w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3 w-1/2" />
        <div className="pt-1 space-y-1.5">
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-full" />
        </div>
        <Bone className="mt-3 h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ── Product grid skeleton ────────────────────────────────────────────────────

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Order item skeleton ──────────────────────────────────────────────────────

export function OrderRowSkeleton() {
  return (
    <div className="card flex gap-4 p-4">
      <Bone className="h-16 w-16 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Bone className="h-4 w-2/3" />
        <Bone className="h-3 w-1/3" />
        <Bone className="h-3 w-1/4" />
      </div>
      <Bone className="h-6 w-20 self-start" />
    </div>
  );
}

export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <OrderRowSkeleton key={i} />)}
    </div>
  );
}

// ── Admin orders table skeleton ──────────────────────────────────────────────

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Filters placeholder */}
      <div className="flex gap-2 flex-wrap">
        {[80, 100, 90, 70, 110].map((w, i) => (
          <div key={i} className="h-8 rounded-xl animate-pulse bg-gray-200 dark:bg-gray-800" style={{ width: `${w}px` }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <Bone className="h-5 w-24 shrink-0" />
          <Bone className="h-5 w-32" />
          <Bone className="h-5 flex-1" />
          <Bone className="h-6 w-20 rounded-full" />
          <Bone className="h-5 w-28" />
        </div>
      ))}
    </div>
  );
}

// ── Product detail skeleton ─────────────────────────────────────────────────

export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="grid gap-10 md:grid-cols-2">
        {/* Images */}
        <div className="space-y-3">
          <Bone className="aspect-square w-full rounded-2xl" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map((i) => <Bone key={i} className="aspect-square rounded-xl" />)}
          </div>
        </div>
        {/* Info */}
        <div className="space-y-4">
          <Bone className="h-8 w-3/4" />
          <Bone className="h-5 w-1/2" />
          <div className="space-y-2">
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-2/3" />
          </div>
          <Bone className="h-14 w-full rounded-2xl" />
          <Bone className="h-14 w-full rounded-2xl" />
          <Bone className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Admin dashboard stat card skeleton ─────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="card p-5 space-y-2">
      <Bone className="h-4 w-1/2" />
      <Bone className="h-8 w-2/3" />
      <Bone className="h-3 w-1/3" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Bone className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1,2,3,4].map((i) => <StatCardSkeleton key={i} />)}
      </div>
      <Bone className="h-64 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Bone className="h-48 rounded-2xl" />
        <Bone className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

// ── Checkout form skeleton ──────────────────────────────────────────────────

export function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Bone className="h-8 w-48" />
        {[1,2,3,4,5].map((i) => <Bone key={i} className="h-12 w-full rounded-xl" />)}
      </div>
      <div className="space-y-4">
        <Bone className="h-48 rounded-2xl" />
        <Bone className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

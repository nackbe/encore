export default function StatsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />

      {/* Stats cards skeleton */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

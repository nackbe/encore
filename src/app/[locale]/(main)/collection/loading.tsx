export default function CollectionLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Grid skeleton */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-square animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

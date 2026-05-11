function Bone({ className }: { className?: string }) {
  return <div className={`rounded-xl shimmer ${className ?? ''}`} />
}

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Topbar skeleton */}
      <div className="h-16 border-b border-cream-300 bg-cream-100/90 px-6 flex items-center gap-4">
        <div className="space-y-2 flex-1">
          <Bone className="h-3.5 w-28" />
          <Bone className="h-2.5 w-44" />
        </div>
        <Bone className="h-9 w-52 hidden md:block" />
        <Bone className="h-9 w-28" />
      </div>

      {/* Page content skeleton */}
      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-cream-200 p-5 shadow-sm space-y-3">
              <Bone className="h-2.5 w-20" />
              <Bone className="h-7 w-16" />
              <Bone className="h-2.5 w-28" />
            </div>
          ))}
        </div>
        {/* Chart row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Bone className="lg:col-span-3 h-64 bg-white border border-cream-200 shadow-sm" />
          <Bone className="lg:col-span-2 h-64 bg-white border border-cream-200 shadow-sm" />
        </div>
        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Bone className="lg:col-span-2 h-52 bg-white border border-cream-200 shadow-sm" />
          <Bone className="lg:col-span-3 h-52 bg-white border border-cream-200 shadow-sm" />
        </div>
      </main>
    </div>
  )
}

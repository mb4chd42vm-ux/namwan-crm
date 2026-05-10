function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? ''}`} />
}

export default function CustomerDetailLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="h-14 border-b border-gray-100 bg-white px-6 flex items-center gap-3">
        <div className="space-y-1.5 flex-1">
          <Bone className="h-3.5 w-36" />
          <Bone className="h-2.5 w-24" />
        </div>
      </div>
      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <Bone className="h-3 w-28" />
        {/* Profile card */}
        <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm flex gap-5">
          <Bone className="h-16 w-16 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-5 w-48" />
            <Bone className="h-3 w-72" />
            <Bone className="h-8 w-full rounded-lg" />
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Bone key={i} className="h-20 bg-white border border-gray-100" />)}
        </div>
        {/* History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Bone className="lg:col-span-2 h-80 bg-white border border-gray-100" />
          <Bone className="h-80 bg-white border border-gray-100" />
        </div>
      </main>
    </div>
  )
}

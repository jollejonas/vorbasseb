export default function Loading() {
  return (
    <div>
      <div className="bg-[#0a0f1e] py-10 px-4">
        <div className="max-w-7xl mx-auto space-y-2">
          <div className="h-3 w-32 bg-white/20 rounded animate-pulse" />
          <div className="h-10 w-24 bg-white/20 rounded animate-pulse" />
          <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex gap-8 items-start">
          <div className="hidden md:block w-52 shrink-0 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden shadow-sm">
                  <div className="aspect-square bg-gray-100 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                    <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

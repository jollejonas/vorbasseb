export default function AdminOrdrerLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 animate-pulse">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-5 w-16 bg-gray-200 rounded" />
        <div className="h-9 w-28 bg-gray-200 rounded" />
      </div>
      <div className="h-10 w-full bg-gray-100 rounded mb-6" />
      <div className="space-y-3">
        <div className="h-8 bg-gray-200 rounded" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

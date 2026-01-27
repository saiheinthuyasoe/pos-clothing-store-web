import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
      <div className="w-full max-w-3xl px-4">
        <div className="flex items-center justify-center">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
        </div>

        <div className="mt-4 text-center text-sm text-gray-700">Loading…</div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-44 bg-gray-100 rounded-md" />
              <div className="mt-2 h-3 bg-gray-100 rounded w-3/4" />
              <div className="mt-2 h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

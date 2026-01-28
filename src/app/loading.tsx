import React from "react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-white/90 to-white/80">
      <div className="w-full max-w-6xl p-6">
        <div className="mx-auto max-w-xl text-center">
          <div className="flex items-center justify-center">
            <div className="h-12 w-12 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
          </div>
          <div className="mt-4 h-6 bg-gray-100 rounded w-48 mx-auto animate-pulse" />
          <div className="mt-3 h-3 bg-gray-100 rounded w-64 mx-auto animate-pulse" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="w-full aspect-[5/8] bg-gray-100 rounded-md" />
              <div className="mt-3 h-3 bg-gray-100 rounded w-3/4" />
              <div className="mt-2 h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

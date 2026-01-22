"use client";

import React from "react";
import ProductsList from "../../components/ProductsList";

export default function Page() {
  return (
    <div className="min-h-screen bg-white font-sans text-black">
      <main className="mx-auto max-w-6xl py-8">
        <section className=" px-6">
          <h1 className="text-2xl font-serif text-center text-gray-800 border-b pb-4 mb-6">
            New Arrivals
          </h1>

          <div className="max-w-[1100px] mx-auto pb-12">
            <React.Suspense
              fallback={<div className="py-8 text-center">Loading...</div>}
            >
              <ProductsList showOnlyNew itemsPerPageDefault={40} hideFilters />
            </React.Suspense>
          </div>
        </section>
      </main>
    </div>
  );
}

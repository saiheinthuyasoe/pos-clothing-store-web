"use client";

import React from "react";
import ProductsList from "../../components/ProductsList";

export default function Page() {
  return (
    <div className="min-h-screen bg-white font-sans text-black">
      <main className="mx-auto max-w-6xl py-8">
        <section className=" px-6">
          <h1 className="text-2xl font-serif text-center text-pink-400 mb-6 font-beatrice">
            New Arrivals
          </h1>

          <div className="border border-pink-300 m-9 mr-30 ml-30"></div>

          <div className="max-w-[1100px] mx-auto pb-12">
            <ProductsList showOnlyNew itemsPerPageDefault={40} hideFilters />
          </div>
        </section>
      </main>
    </div>
  );
}

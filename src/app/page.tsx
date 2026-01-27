"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import ProductsList from "../components/ProductsList";

function Carousel() {
  type Item = {
    image?: string;
    groupImage?: string;
    name?: string;
  };

  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // Fetch 4 newest items from backend
    fetch("/api/new-items")
      .then((res) => res.json())
      .then((data) => {
        setItems(data?.items?.slice(0, 4) || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Autoplay
  useEffect(() => {
    if (!items.length) return;
    if (paused) return;
    const id = setInterval(() => {
      setCurrent((c) => (c === items.length - 1 ? 0 : c + 1));
    }, 4000);
    return () => clearInterval(id);
  }, [items, paused]);
  if (loading) {
    return (
      <div className="w-full h-120 flex items-center justify-center bg-gray-100 rounded-lg">
        <span className="text-gray-400">Loading new items…</span>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="w-full h-120 flex items-center justify-center bg-gray-100 rounded-lg">
        <span className="text-gray-500">No new items found.</span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full mb-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden w-full h-120 bg-white">
        <Image
          src={
            items[current]?.image ||
            items[current]?.groupImage ||
            "/fallback.png"
          }
          alt={items[current]?.name || "Product"}
          className="object-contain object-center transition-all duration-500"
          fill
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-x-0 bottom-2 flex justify-center space-x-2">
        {items.map((_, idx) => (
          <button
            key={idx}
            className={`w-3 h-3 rounded-full border transition-all duration-200 ${
              idx === current
                ? "bg-gray-600 border-gray-600"
                : "bg-white border-gray-400"
            }`}
            onClick={() => setCurrent(idx)}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-3 shadow-lg hover:bg-opacity-70 text-white flex items-center justify-center"
        onClick={() => setCurrent((c) => (c === 0 ? items.length - 1 : c - 1))}
        aria-label="Previous slide"
        title="Previous"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-3 shadow-lg hover:bg-opacity-70 text-white flex items-center justify-center"
        onClick={() => setCurrent((c) => (c === items.length - 1 ? 0 : c + 1))}
        aria-label="Next slide"
        title="Next"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="bg-white bg-opacity-80 px-3 py-1 rounded text-lg font-semibold">
          {items[current]?.name}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-black">
      <Carousel />
      <main className="mx-auto max-w-6xl">
        <section id="products" className="mt-12 px-6">
          <ProductsList />
        </section>
      </main>
    </div>
  );
}

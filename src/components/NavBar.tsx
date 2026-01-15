"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      className={`sticky top-0 z-50 bg-white transition-shadow ${
        scrolled ? "shadow-md" : "border-b"
      }`}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between p-3">
        {/* Left: hamburger / collapse menu */}
        <div className="flex items-center">
          <button
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((s) => !s)}
            className="p-2 rounded-md hover:bg-gray-100 md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* desktop menu (hidden on small screens) */}
          <div className="hidden md:flex items-center space-x-4 text-sm ml-2">
            <a href="#" className="text-gray-700 hover:text-black">
              Home
            </a>
            <a href="#" className="text-gray-700 hover:text-black">
              Location
            </a>
          </div>
        </div>

        {/* Center: logo + shop name */}
        <div className="flex-1 flex items-center justify-center md:justify-center">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-lg font-semibold text-black">
              Simple Clothing
            </span>
          </Link>
        </div>

        {/* Right: search collapse */}
        <div className="flex items-center space-x-2">
          <div
            className={`hidden md:flex items-center border rounded-md px-2 py-1`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
            <input
              placeholder="Search products"
              className="ml-2 outline-none text-sm"
            />
          </div>

          {/* mobile search toggle */}
          <button
            aria-label="Toggle search"
            onClick={() => setSearchOpen((s) => !s)}
            className="p-2 rounded-md hover:bg-gray-100 md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="px-4 py-3 space-y-2">
            <a href="#" className="block text-gray-700">
              Home
            </a>
            <a href="#" className="block text-gray-700">
              Location
            </a>
          </div>
        </div>
      )}

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="md:hidden border-t bg-white px-4 py-3">
          <div className="flex items-center space-x-2">
            <input
              autoFocus
              placeholder="Search products"
              className="w-full border rounded-md px-3 py-2 text-sm outline-none"
            />
            <button
              aria-label="Close search"
              onClick={() => setSearchOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-700"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 8.586L15.95 2.636a1 1 0 111.414 1.414L11.414 10l5.95 5.95a1 1 0 01-1.414 1.414L10 11.414l-5.95 5.95A1 1 0 012.636 15.95L8.586 10 2.636 4.05A1 1 0 014.05 2.636L10 8.586z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

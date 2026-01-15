"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";

type SizeQuantity = {
  size?: string;
  quantity?: number | string;
};

type ColorVariant = {
  id?: string;
  color?: string;
  colorCode?: string;
  image?: string;
  sizeQuantities?: SizeQuantity[];
};

type FirestoreTimestampLike =
  | { toMillis?: () => number }
  | number
  | string
  | null;

type FirestoreStockDoc = {
  groupName?: string;
  name?: string;
  unitPrice?: number;
  price?: number;
  category?: string;
  description?: string;
  image?: string;
  groupImage?: string;
  colorVariants?: ColorVariant[];
  stock?: number;
  createdAt?: FirestoreTimestampLike;
  [key: string]: unknown;
};

type Product = {
  id: string;
  name?: string;
  price?: number;
  description?: string;
  image?: string;
  groupImage?: string;
  colorVariants?: ColorVariant[];
  stock?: number;
  createdAt?: FirestoreTimestampLike;
  isNew?: boolean;
};

export default function ProductsList() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>(
    {}
  );
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>(
    {}
  );
  const [mmkRate, setMmkRate] = useState<number>(
    Number(process?.env?.NEXT_PUBLIC_MMK_RATE) || 55
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(40);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // The main app stores items under the `stocks` collection.
        // Ensure newest items are returned first by ordering on `createdAt` desc.
        if (!db) {
          setError("Firebase not configured");
          return;
        }
        const q = query(collection(db, "stocks"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const NEW_DAYS = Number(process?.env?.NEXT_PUBLIC_NEW_ITEM_DAYS) || 7;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        const items: Product[] = snap.docs.map((d) => {
          const data = d.data() as FirestoreStockDoc;
          const colorVariants = (data.colorVariants as ColorVariant[]) || [];
          const stockFromVariants = Array.isArray(colorVariants)
            ? colorVariants.reduce(
                (total: number, v: ColorVariant) =>
                  total +
                  (v.sizeQuantities || []).reduce(
                    (t: number, s: SizeQuantity) =>
                      t + (Number(s.quantity) || 0),
                    0
                  ),
                0
              )
            : 0;

          return {
            id: d.id,
            name: data.groupName || data.name,
            price:
              typeof data.unitPrice === "number" ? data.unitPrice : data.price,
            description: data.category || data.description,
            image:
              data.colorVariants?.[0]?.image || data.image || data.groupImage,
            groupImage: data.groupImage,
            colorVariants: colorVariants,
            stock: data.stock || stockFromVariants || 0,
            createdAt: data.createdAt || null,
            isNew: (() => {
              try {
                const created = data.createdAt;
                let createdMs = Date.now();
                if (created) {
                  if (
                    typeof created === "object" &&
                    created !== null &&
                    "toMillis" in created &&
                    typeof (created as { toMillis?: unknown }).toMillis ===
                      "function"
                  ) {
                    createdMs = (
                      created as { toMillis: () => number }
                    ).toMillis();
                  } else if (typeof created === "number") {
                    createdMs = created;
                  } else {
                    createdMs = new Date(String(created)).getTime();
                  }
                }
                return Date.now() - createdMs <= NEW_DAYS * MS_PER_DAY;
              } catch (e) {
                return false;
              }
            })(),
          };
        });
        setProducts(items);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Load currency rate from owner settings API (authoritative source).
  useEffect(() => {
    const loadRate = async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("/api/settings returned non-ok", res.status, text);
          return;
        }
        const json = await res.json().catch((err) => {
          console.error("Failed parsing /api/settings JSON", err);
          return null;
        });
        const rate =
          json?.data?.currencyRate ??
          json?.currencyRate ??
          json?.data?.currencyRate;
        const parsed = Number(rate);
        if (!Number.isNaN(parsed) && parsed > 0) setMmkRate(parsed);
      } catch (e) {
        console.error("Error fetching /api/settings:", e);
      }
    };

    loadRate();
  }, []);

  // Pagination calculations (hooks must be declared before any early returns)
  const totalPages = products
    ? Math.max(1, Math.ceil(products.length / itemsPerPage))
    : 1;
  // ensure current page is within bounds when products change
  useEffect(() => {
    setCurrentPage(1);
  }, [products]);

  const startIndex = products ? (currentPage - 1) * itemsPerPage : 0;
  const endIndex = startIndex + itemsPerPage;
  const visibleProducts = products ? products.slice(startIndex, endIndex) : [];

  if (loading) return <div className="p-8">Loading products…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!products || products.length === 0)
    return <div className="p-8">No products found.</div>;

  const handleColorSelect = (productId: string, colorId: string) => {
    setSelectedColors((prev) => {
      const current = prev[productId];
      const next = current === colorId ? "" : colorId;
      return { ...prev, [productId]: next };
    });
    setSelectedSizes((prev) => ({ ...prev, [productId]: "" }));
  };

  const handleSizeSelect = (productId: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
  };

  const getCurrentImage = (p: Product) => {
    // prefer color variant image -> group image -> product image
    const variantImg = p.colorVariants?.find(
      (v: ColorVariant, i: number) =>
        (v.id ?? `${p.id}-v-${i}`) === selectedColors[p.id]
    )?.image;
    return (
      variantImg ||
      p.groupImage ||
      p.image ||
      `https://via.placeholder.com/400x500/E5E7EB/6B7280?text=${encodeURIComponent(
        p.name || "Product"
      )}`
    );
  };

  // Conversion rate THB -> MMK (Ks). `mmkRate` state is populated from owner
  // settings API and falls back to `NEXT_PUBLIC_MMK_RATE`.

  return (
    <>
      <div className="grid grid-cols-2 gap-2 px-2 py-4 sm:grid-cols-2 md:gap-4 md:px-6 md:py-6 md:grid-cols-2 lg:gap-6 lg:px-6 lg:grid-cols-3 xl:gap-8 xl:px-6 xl:grid-cols-4 bg-white md:max-w-[1000px] md:mx-auto lg:max-w-[1400px] lg:mx-auto xl:max-w-[1800px] xl:mx-auto">
        {visibleProducts.map((p) => {
          const hasVariants =
            Array.isArray(p.colorVariants) && p.colorVariants.length > 0;
          const displayStock = p.stock ?? (p.price ? 10 : 0);
          const isOutOfStock = displayStock === 0;

          const variant = hasVariants
            ? p.colorVariants!.find(
                (v: ColorVariant, i: number) =>
                  (v.id ?? `${p.id}-v-${i}`) === selectedColors[p.id]
              ) || p.colorVariants![0]
            : null;

          // If a color is selected, show sizes for that variant only.
          // If no color selected, aggregate sizes across all variants and
          // show sizes whose total quantity > 0.
          let availableSizes: SizeQuantity[] = [];
          if (hasVariants) {
            if (selectedColors[p.id]) {
              availableSizes = (variant?.sizeQuantities || []).filter(
                (sq: SizeQuantity) => Number(sq.quantity) > 0
              );
            } else {
              const sizeMap: Record<string, number> = {};
              const order: string[] = [];
              p.colorVariants!.forEach((v: ColorVariant) => {
                (v.sizeQuantities || []).forEach((sq: SizeQuantity) => {
                  const key = String(sq.size);
                  if (!order.includes(key)) order.push(key);
                  sizeMap[key] = (sizeMap[key] || 0) + Number(sq.quantity || 0);
                });
              });
              availableSizes = order
                .map((s) => ({ size: s, quantity: sizeMap[s] || 0 }))
                .filter((x) => Number(x.quantity) > 0);
            }
          } else {
            availableSizes = [];
          }

          return (
            <div
              key={p.id}
              className={`group bg-white overflow-visible hover:shadow-lg transition-transform duration-200 ${
                isOutOfStock ? "opacity-80" : ""
              }`}
            >
              <div className="relative bg-white overflow-hidden p-0">
                {p.isNew && !isOutOfStock && (
                  <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1 py-0.5 rounded z-10">
                    New
                  </span>
                )}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      OUT OF STOCK
                    </span>
                  </div>
                )}

                <div className="w-full aspect-[5/8] overflow-hidden bg-white transform transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getCurrentImage(p)}
                    alt={p.name}
                    className={`w-full h-full object-cover block ${
                      isOutOfStock ? "opacity-60" : ""
                    }`}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>

                {/* overlay category/shop if available */}
                {p.description && (
                  <div className="absolute bottom-2 right-2 flex flex-col items-end space-y-1 z-10">
                    {p.description && (
                      <span className="bg-white bg-opacity-60 text-xs text-gray-900 px-2 py-0.5 rounded">
                        {p.description}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-2 md:p-3 lg:p-4">
                <h4 className="font-medium text-gray-900 text-sm mb-1">
                  {p.name && p.name.length > 24
                    ? `${p.name.substring(0, 24)}...`
                    : p.name}
                </h4>

                <div className="mb-2">
                  {p.price ? (
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{`${p.price.toFixed(
                        2
                      )} THB`}</span>
                      <span className="ml-3 text-gray-500">{`${Math.round(
                        p.price * mmkRate
                      ).toLocaleString()} Ks`}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-900">—</span>
                  )}
                </div>

                {/* Color selection */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Color:
                  </label>
                  <div className="flex items-center space-x-2">
                    {hasVariants ? (
                      p.colorVariants!.map(
                        (variant: ColorVariant, index: number) => {
                          const vid = variant.id ?? `${p.id}-v-${index}`;
                          const isSelected = selectedColors[p.id] === vid;
                          return (
                            <button
                              key={vid}
                              onClick={() => handleColorSelect(p.id, vid)}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${
                                isSelected
                                  ? "border-blue-500 ring-2 ring-blue-200"
                                  : "border-gray-300 hover:border-gray-400"
                              }`}
                              style={{
                                backgroundColor: variant.colorCode || "#ddd",
                              }}
                              title={variant.color}
                            />
                          );
                        }
                      )
                    ) : (
                      <span className="text-xs text-gray-500">
                        No color variants
                      </span>
                    )}
                  </div>
                </div>

                {/* Size selection */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Size:
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {availableSizes.length > 0 ? (
                      availableSizes.map((s: SizeQuantity) => {
                        const isSelected = selectedSizes[p.id] === s.size;
                        const soldOut = Number(s.quantity) === 0;
                        return (
                          <button
                            key={`${p.id}-${s.size}`}
                            onClick={() =>
                              !soldOut &&
                              handleSizeSelect(p.id, s.size as string)
                            }
                            disabled={soldOut}
                            className={`text-xs py-0.5 px-1  border border-gray-300 transition-all `}
                          >
                            <div className="flex flex-col items-center">
                              <span>{s.size}</span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-500 col-span-3">
                        {hasVariants ? "No sizes available" : "—"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Add to cart removed for storefront view */}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-center space-x-2 mt-6">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded border border-gray-300 bg-white text-sm disabled:opacity-50"
        >
          Prev
        </button>

        <div className="flex items-center space-x-1">
          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded text-sm border ${
                  currentPage === page
                    ? "bg-gray-600 text-white border-gray-600"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded border border-gray-300 bg-white text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </>
  );
}

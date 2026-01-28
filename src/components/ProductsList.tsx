"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
  category?: string;
  image?: string;
  groupImage?: string;
  colorVariants?: ColorVariant[];
  stock?: number;
  createdAt?: FirestoreTimestampLike;
  isNew?: boolean;
  shop?: string;
};

export default function ProductsList({
  showOnlyNew = false,
  itemsPerPageDefault = 40,
  hideFilters = false,
}: {
  showOnlyNew?: boolean;
  itemsPerPageDefault?: number;
  hideFilters?: boolean;
}) {
  const searchParams = useSearchParams();
  const urlQuery = (searchParams?.get("q") || "").trim();
  const [localQuery, setLocalQuery] = useState(urlQuery);

  // sync localQuery with URL param changes
  useEffect(() => {
    setLocalQuery(urlQuery);
  }, [urlQuery]);

  // listen for global search events dispatched from NavBar when using replaceState
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const q = (e?.detail || "").toString();
      setLocalQuery(q || "");
    };
    if (typeof window !== "undefined") {
      window.addEventListener("app:search", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("app:search", handler as EventListener);
      }
    };
  }, []);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>(
    {},
  );
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>(
    {},
  );
  const [mmkRate, setMmkRate] = useState<number>(
    Number(process?.env?.NEXT_PUBLIC_MMK_RATE) || 55,
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(itemsPerPageDefault);
  const [showFilter, setShowFilter] = useState(false);
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterCurrency, setFilterCurrency] = useState<"THB" | "MMK">("THB");
  const [filterSize, setFilterSize] = useState<string>("");
  const [expandedBranch, setExpandedBranch] = useState<boolean>(true);
  const [expandedCategory, setExpandedCategory] = useState<boolean>(false);
  const [expandedSize, setExpandedSize] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<
    "newest" | "price-asc" | "price-desc" | "name-asc" | "name-desc"
  >("newest");
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);

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
                    0,
                  ),
                0,
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
            shop:
              (data as FirestoreStockDoc).shop?.toString() ||
              (data as FirestoreStockDoc).shopId?.toString() ||
              (data as FirestoreStockDoc).branch?.toString() ||
              "",
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

  // fetch shops (branches) for the branch filter
  useEffect(() => {
    const loadShops = async () => {
      try {
        const res = await fetch("/api/shops");
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (json && Array.isArray(json.data)) {
          const mapped = json.data.map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          }));
          setShops(mapped);
        }
      } catch (e) {
        console.error("Failed loading /api/shops", e);
      }
    };

    loadShops();
  }, []);

  // derive filter option lists from products
  const branches = shops;
  // derive available options scoped to the selected branch
  const branchFilteredProducts = (() => {
    if (!products) return [] as Product[];
    if (filterBranch === "all") return products;
    const selectedShop = shops.find((s) => s.id === filterBranch);
    const shopName = selectedShop?.name;
    return products.filter((p) => {
      const pShop = ((p as Product).shop || "").toString();
      return pShop === filterBranch || pShop === shopName;
    });
  })();

  const categories = branchFilteredProducts
    ? Array.from(
        new Set(
          branchFilteredProducts
            .map(
              (p) =>
                (p as Product).description || (p as Product).category || "",
            )
            .filter(Boolean),
        ),
      )
    : [];
  // derive unique colors with optional color codes
  const sizes = branchFilteredProducts
    ? Array.from(
        new Set(
          branchFilteredProducts
            .flatMap((p) => (p as Product).colorVariants || [])
            .flatMap((v: ColorVariant) =>
              (v.sizeQuantities || []).map((s: SizeQuantity) => s.size),
            )
            .filter(Boolean),
        ),
      )
    : [];

  // when branch changes, ensure selected category/color/size remain valid
  useEffect(() => {
    if (!branchFilteredProducts) return;
    if (filterCategory !== "all" && !categories.includes(filterCategory)) {
      setFilterCategory("all");
    }
    if (filterSize && !sizes.map(String).includes(String(filterSize))) {
      setFilterSize("");
    }
  }, [filterBranch, shops, products]);

  // apply filters
  const filteredProducts = products
    ? products.filter((p) => {
        if (filterBranch !== "all") {
          const selectedShop = shops.find((s) => s.id === filterBranch);
          const shopName = selectedShop?.name;
          const pShop = ((p as Product).shop || "").toString();
          // match by id or by name
          if (pShop !== filterBranch && pShop !== shopName) return false;
        }
        if (
          filterCategory !== "all" &&
          ((p as Product).description || (p as Product).category || "") !==
            filterCategory
        )
          return false;
        // color filter removed
        if (filterSize) {
          const hasSize = ((p as Product).colorVariants || []).some(
            (v: ColorVariant) =>
              (v.sizeQuantities || []).some(
                (sq: SizeQuantity) =>
                  String(sq.size) === filterSize && Number(sq.quantity) > 0,
              ),
          );
          if (!hasSize) return false;
        }
        if (showOnlyNew && !(p as Product).isNew) return false;
        // when showing only new arrivals, exclude out-of-stock items
        if (showOnlyNew) {
          const qty = Number((p as Product).stock || 0);
          if (qty <= 0) return false;
        }
        if (filterMinPrice || filterMaxPrice) {
          const price = Number(p.price || 0);
          const priceCompare =
            filterCurrency === "THB" ? price : Math.round(price * mmkRate);
          if (filterMinPrice && priceCompare < Number(filterMinPrice))
            return false;
          if (filterMaxPrice && priceCompare > Number(filterMaxPrice))
            return false;
        }

        // URL search query filtering (case-insensitive) — match name or description
        const effectiveQuery = (localQuery || urlQuery || "").trim();
        if (effectiveQuery) {
          const q = effectiveQuery.toLowerCase();
          const name = String(p.name || "").toLowerCase();
          const desc = String(p.description || "").toLowerCase();
          if (!name.includes(q) && !desc.includes(q)) return false;
        }
        return true;
      })
    : [];

  // Apply sorting, then put out-of-stock items at the end while preserving relative order
  const sortedProducts = filteredProducts
    ? (() => {
        const list = filteredProducts.slice();
        list.sort((a: Product, b: Product) => {
          try {
            if (sortBy === "newest") {
              const aVal = Number(
                (a.createdAt &&
                typeof a.createdAt === "object" &&
                a.createdAt !== null &&
                "toMillis" in a.createdAt &&
                typeof (a.createdAt as { toMillis?: () => number }).toMillis ===
                  "function"
                  ? (a.createdAt as { toMillis: () => number }).toMillis()
                  : a.createdAt) ?? 0,
              );
              const bVal = Number(
                (b.createdAt &&
                typeof b.createdAt === "object" &&
                b.createdAt !== null &&
                "toMillis" in b.createdAt &&
                typeof (b.createdAt as { toMillis?: () => number }).toMillis ===
                  "function"
                  ? (b.createdAt as { toMillis: () => number }).toMillis()
                  : b.createdAt) ?? 0,
              );
              return bVal - aVal; // newest first
            }

            if (sortBy === "price-asc") {
              const aP = Number(a.price ?? 0);
              const bP = Number(b.price ?? 0);
              return aP - bP;
            }

            if (sortBy === "price-desc") {
              const aP = Number(a.price ?? 0);
              const bP = Number(b.price ?? 0);
              return bP - aP;
            }

            if (sortBy === "name-asc") {
              return String(a.name || "").localeCompare(String(b.name || ""));
            }

            if (sortBy === "name-desc") {
              return String(b.name || "").localeCompare(String(a.name || ""));
            }
          } catch (e) {
            return 0;
          }
          return 0;
        });

        const inStock: Product[] = [];
        const outStock: Product[] = [];
        for (const p of list) {
          const qty = Number((p as Product).stock || 0);
          if (qty > 0) inStock.push(p);
          else outStock.push(p);
        }
        return [...inStock, ...outStock];
      })()
    : [];

  // Pagination calculations (hooks must be declared before any early returns)
  const totalPages = Math.max(
    1,
    Math.ceil(sortedProducts.length / itemsPerPage),
  );
  // ensure current page is within bounds when products or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    products,
    filterBranch,
    filterCategory,
    filterSize,
    filterMinPrice,
    filterMaxPrice,
    filterCurrency,
  ]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const visibleProducts = sortedProducts.slice(startIndex, endIndex);

  if (loading)
    return (
      <div className="bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mx-auto max-w-xl text-center">
            <div className="flex items-center justify-center">
              <div className="h-12 w-12 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
            </div>
            <div className="mt-4 h-6 bg-gray-100 rounded w-48 mx-auto animate-pulse" />
            <div className="mt-3 h-3 bg-gray-100 rounded w-64 mx-auto animate-pulse" />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({
              length: Math.min(12, Math.max(6, itemsPerPage)),
            }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white">
                <div className="w-full aspect-[5/8] bg-gray-100 rounded-md" />
                <div className="px-2 py-3">
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!products || products.length === 0)
    return <div className="p-8">No products found.</div>;

  const effectiveQuery = (localQuery || urlQuery || "").trim();
  if (effectiveQuery && filteredProducts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="text-lg md:text-xl font-medium text-gray-700">
          No items found for &quot;{effectiveQuery}&quot;
        </div>
        <div className="mt-3 text-sm text-gray-500">
          Try a different search term or clear filters.
        </div>
      </div>
    );
  }
  if (!effectiveQuery && filteredProducts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="text-lg md:text-xl font-medium text-gray-700">
          No items match the current filters.
        </div>
        <div className="mt-3 text-sm text-gray-500">
          Try clearing filters or adjusting your criteria.
        </div>
      </div>
    );
  }

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
        (v.id ?? `${p.id}-v-${i}`) === selectedColors[p.id],
    )?.image;
    return (
      variantImg ||
      p.groupImage ||
      p.image ||
      `https://via.placeholder.com/400x500/E5E7EB/6B7280?text=${encodeURIComponent(
        p.name || "Product",
      )}`
    );
  };

  // removed old getColorCode helper — colors now include codes

  // Conversion rate THB -> MMK (Ks). `mmkRate` state is populated from owner
  // settings API and falls back to `NEXT_PUBLIC_MMK_RATE`.

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between px-2 py-2 md:px-6 md:py-4">
        <div className="flex flex-col md:flex-row md:items-center">
          <div className="text-sm text-gray-600">
            {filteredProducts ? `${filteredProducts.length} items` : ""}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2 ml-3 md:mt-0">
            {filterBranch !== "all" && (
              <span className="inline-flex items-center space-x-2 bg-pink-300 text-white text-sm px-3 py-1 rounded">
                <span>
                  {shops.find((s) => s.id === filterBranch)?.name ||
                    filterBranch}
                </span>
                <button
                  onClick={() => setFilterBranch("all")}
                  aria-label="Remove branch filter"
                  className="text-amber-700 hover:text-amber-900 ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {filterCategory !== "all" && (
              <span className="inline-flex items-center space-x-2 bg-pink-300 text-white text-sm px-3 py-1 rounded">
                <span>{filterCategory}</span>
                <button
                  onClick={() => setFilterCategory("all")}
                  aria-label="Remove category filter"
                  className="text-amber-700 hover:text-amber-900 ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {/* color filter removed */}

            {filterSize && (
              <span className="inline-flex items-center space-x-2 bg-pink-300 text-white text-sm px-3 py-1 rounded">
                <span>{filterSize}</span>
                <button
                  onClick={() => setFilterSize("")}
                  aria-label="Remove size filter"
                  className="text-amber-700 hover:text-amber-900 ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {(filterMinPrice || filterMaxPrice) && (
              <span className="inline-flex items-center space-x-2 bg-pink-300 text-white text-sm px-3 py-1 rounded">
                <span>
                  {filterCurrency === "THB" ? "฿" : "Ks"}{" "}
                  {filterMinPrice || "-"} - {filterMaxPrice || "-"}
                </span>
                <button
                  onClick={() => {
                    setFilterMinPrice("");
                    setFilterMaxPrice("");
                  }}
                  aria-label="Remove price filter"
                  className="text-amber-700 hover:text-amber-900 ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {(filterBranch !== "all" ||
              filterCategory !== "all" ||
              filterSize ||
              filterMinPrice ||
              filterMaxPrice) && (
              <button
                onClick={() => {
                  setFilterBranch("all");
                  setFilterCategory("all");
                  setFilterSize("");
                  setFilterMinPrice("");
                  setFilterMaxPrice("");
                  setFilterCurrency("THB");
                }}
                className="text-md text-red-600 underline md:ml-2 ml-0"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-3 md:mt-0">
          <div>
            {!hideFilters && (
              <button
                onClick={() => setShowFilter((s) => !s)}
                aria-expanded={showFilter}
                aria-controls="filters-panel"
                className="px-3 py-1 rounded border border-gray-300 bg-white text-sm hover:bg-gray-50 inline-flex items-center space-x-2"
              >
                <span>Filters</span>
                <svg
                  className={`h-4 w-4 transform transition-transform duration-200 ${showFilter ? "rotate-180" : "rotate-0"}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M5 8.5L10 13.5L15 8.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Sort control */}
          <div className="text-sm">
            <label className="sr-only">Sort by</label>
            <div className="relative inline-flex items-center">
              <select
                title="sortBy"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "newest"
                      | "price-asc"
                      | "price-desc"
                      | "name-asc"
                      | "name-desc",
                  )
                }
                className="peer border border-gray-200 rounded px-2 py-1 text-sm bg-white appearance-none pr-8"
              >
                <option value="newest">Sort by: Newest</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
              </select>
              <svg
                className="h-4 w-4 absolute right-2 transform transition-transform duration-200 peer-focus:rotate-180 pointer-events-none text-gray-600"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M5 8.5L10 13.5L15 8.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-2 py-4 sm:grid-cols-2 md:gap-4 md:px-6 md:py-6 md:grid-cols-2 lg:gap-6 lg:px-6 lg:grid-cols-3 xl:gap-8 xl:px-6 xl:grid-cols-4 2xl:grid-cols-5 bg-white md:max-w-[1000px] md:mx-auto lg:max-w-[1400px] lg:mx-auto xl:max-w-[1800px] xl:mx-auto">
        {visibleProducts.map((p) => {
          const hasVariants =
            Array.isArray(p.colorVariants) && p.colorVariants.length > 0;
          const displayStock = p.stock ?? (p.price ? 10 : 0);
          const isOutOfStock = displayStock === 0;

          const variant = hasVariants
            ? p.colorVariants!.find(
                (v: ColorVariant, i: number) =>
                  (v.id ?? `${p.id}-v-${i}`) === selectedColors[p.id],
              ) || p.colorVariants![0]
            : null;

          // If a color is selected, show sizes for that variant only.
          // If no color selected, aggregate sizes across all variants and
          // show sizes whose total quantity > 0.
          let availableSizes: SizeQuantity[] = [];
          if (hasVariants) {
            if (selectedColors[p.id]) {
              availableSizes = (variant?.sizeQuantities || []).filter(
                (sq: SizeQuantity) => Number(sq.quantity) > 0,
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
            <Link key={p.id} href={`/product/${p.id}`} className="block">
              <div
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

                <div className="pt-3">
                  <h4 className="font-semibold text-gray-900 text-base mb-1">
                    {p.name && p.name.length > 24
                      ? `${p.name.substring(0, 24)}...`
                      : p.name}
                  </h4>

                  <div className="mb-5">
                    {p.price ? (
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">
                          {Number.isInteger(p.price)
                            ? `฿ ${p.price.toFixed(0)}`
                            : `฿ ${p.price.toFixed(2)}`}
                        </span>
                        <span className="text-gray-500">{` / ${Math.round(
                          p.price * mmkRate,
                        ).toLocaleString()} Ks`}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-900">—</span>
                    )}
                  </div>

                  {/* Color selection */}
                  {/* <div className="mb-3">
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
                  </div> */}

                  {/* Size selection */}
                  {/* <div className="mb-3">
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
                  </div> */}

                  {/* Add to cart removed for storefront view */}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {/* Slide-in filter panel (hidden when `hideFilters`) */}
      {!hideFilters && (
        <>
          <div
            className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
              showFilter
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setShowFilter(false)}
            aria-hidden
          />

          <div
            className={`fixed inset-y-0 left-0 z-50 w-70 bg-white shadow-lg transform transition-transform duration-300 ${
              showFilter ? "translate-x-0" : "-translate-x-full"
            }`}
            aria-hidden={!showFilter}
          >
            <div className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-3xl font-medium font-beatrice">Filters</h3>
                <button
                  onClick={() => setShowFilter(false)}
                  aria-label="Close filters"
                  className="text-gray-500 hover:text-gray-700 p-1 rounded"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 6l12 12" />
                    <path d="M6 18L18 6" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 overflow-auto pr-4 pt-6 pb-6">
                <div className="pb-3">
                  <button
                    type="button"
                    onClick={() => setExpandedBranch((s) => !s)}
                    aria-expanded={expandedBranch}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-800"
                  >
                    <span>Branch</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className={`transform transition-transform h-6 w-6 ${expandedBranch ? "rotate-180" : "rotate-0"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  <div
                    className={`mt-2 space-y-2 ${expandedBranch ? "block" : "hidden"}`}
                  >
                    <button
                      onClick={() => setFilterBranch("all")}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${filterBranch === "all" ? "bg-pink-300 text-white" : "bg-white text-gray-700 border border-gray-200"}`}
                    >
                      All branches
                    </button>

                    {branches.map((sh: { id: string; name: string }) => (
                      <button
                        key={sh.id}
                        onClick={() => setFilterBranch(sh.id)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${filterBranch === sh.id ? "bg-pink-300 text-white" : "bg-white text-gray-700 border border-gray-200"}`}
                      >
                        {sh.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                <div className="pt-3 pb-3">
                  <button
                    type="button"
                    onClick={() => setExpandedCategory((s) => !s)}
                    aria-expanded={expandedCategory}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-800"
                  >
                    <span>Category</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className={`transform transition-transform h-6 w-6 ${expandedCategory ? "rotate-180" : "rotate-0"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  <div
                    className={`mt-2 space-y-2 ${expandedCategory ? "block" : "hidden"}`}
                  >
                    <button
                      onClick={() => setFilterCategory("all")}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${filterCategory === "all" ? "bg-pink-300 text-white" : "bg-white text-gray-700 border border-gray-200"}`}
                    >
                      All categories
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFilterCategory(c)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${filterCategory === c ? "bg-pink-300 text-white" : "bg-white text-gray-700 border border-gray-200"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                {/* color filter removed */}

                <div className="pt-3 pb-3">
                  <button
                    type="button"
                    onClick={() => setExpandedSize((s) => !s)}
                    aria-expanded={expandedSize}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-800"
                  >
                    <span>Size</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className={`transform transition-transform h-6 w-6 ${expandedSize ? "rotate-180" : "rotate-0"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  <div className={`mt-2 ${expandedSize ? "block" : "hidden"}`}>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setFilterSize("")}
                        className={`col-span-4 text-left px-3 py-2 rounded text-sm ${
                          filterSize === ""
                            ? "bg-pink-300 text-white"
                            : "bg-white text-gray-700 border border-gray-200"
                        }`}
                      >
                        Any size
                      </button>

                      {sizes.map((s) => (
                        <button
                          key={String(s)}
                          onClick={() => setFilterSize(String(s))}
                          className={`text-center px-2 py-2 rounded text-sm ${
                            filterSize === String(s)
                              ? "bg-pink-300 text-white"
                              : "bg-white text-gray-700 border border-gray-200"
                          }`}
                        >
                          {String(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                <div className="pt-3 pb-3">
                  <label className="bw-full flex items-center justify-between text-sm font-medium text-gray-800">
                    Price ({filterCurrency === "THB" ? "฿" : "Ks"})
                  </label>
                  <div className="mt-2 flex items-center space-x-2 text-sm">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="currency"
                        checked={filterCurrency === "THB"}
                        onChange={() => setFilterCurrency("THB")}
                        className="mr-1"
                      />
                      ฿
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="currency"
                        checked={filterCurrency === "MMK"}
                        onChange={() => setFilterCurrency("MMK")}
                        className="mr-1"
                      />
                      Ks
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="number"
                      value={filterMinPrice}
                      onChange={(e) => setFilterMinPrice(e.target.value)}
                      placeholder="Min"
                      className="w-1/2 border border-gray-200 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      value={filterMaxPrice}
                      onChange={(e) => setFilterMaxPrice(e.target.value)}
                      placeholder="Max"
                      className="w-1/2 border border-gray-200 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setFilterBranch("all");
                      setFilterCategory("all");
                      setFilterSize("");
                      setFilterMinPrice("");
                      setFilterMaxPrice("");
                      setFilterCurrency("THB");
                    }}
                    className="px-3 py-2 rounded-full border border-gray-300 bg-white text-sm"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => {
                      // apply current filters (they're live) then close panel and reset pagination
                      setShowFilter(false);
                      setCurrentPage(1);
                    }}
                    aria-label="Apply filters"
                    className="ml-auto px-3 py-2 rounded-full bg-pink-400 text-white text-sm"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

type ProductItem = {
  id: string;
  name?: string;
  price?: number;
  image?: string;
  groupImage?: string;
  stock?: number;
  createdAt?: Timestamp | number | Date | null;
  salesCount?: number;
};

type TransactionDoc = Record<string, unknown> & { createdAt?: unknown };
type ProductDoc = Record<string, unknown> & {
  unitPrice?: number;
  price?: number;
  colorVariants?: Array<Record<string, unknown>>;
  image?: string;
  groupImage?: string;
  stock?: number;
  createdAt?: unknown;
  groupName?: string;
  name?: string;
};

export default function BestSellersPage() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [sortBy, setSortBy] = useState<
    "sales" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "newest"
  >("sales");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!db) {
          setError("Firebase not configured");
          return;
        }

        // Build sales counts from transactions in the last 30 days
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const DAYS = 30;
        const cutoff = Date.now() - DAYS * MS_PER_DAY;

        const txQ = query(
          collection(db, "transactions"),
          orderBy("createdAt", "desc"),
        );
        const txSnap = await getDocs(txQ);
        const counts: Record<string, number> = {};

        txSnap.docs.forEach((d) => {
          const data = d.data() as TransactionDoc;
          // determine createdAt milliseconds
          let createdMs = Date.now();
          try {
            const c = data.createdAt as unknown;
            if (c) {
              if (
                typeof c === "object" &&
                c !== null &&
                "toMillis" in c &&
                typeof (c as { toMillis?: () => number }).toMillis ===
                  "function"
              ) {
                createdMs = (c as { toMillis: () => number }).toMillis();
              } else if (typeof c === "number") createdMs = c as number;
              else createdMs = new Date(String(c)).getTime();
            }
          } catch (e) {
            createdMs = Date.now();
          }

          if (Date.now() - createdMs > DAYS * MS_PER_DAY) return;

          // Inspect arrays in transaction doc to find items
          Object.values(data).forEach((val) => {
            if (Array.isArray(val)) {
              val.forEach((it) => {
                if (!it || typeof it !== "object") return;
                const obj = it as Record<string, unknown>;
                const pid =
                  (obj.stockId as string) ||
                  (obj.productId as string) ||
                  (obj.id as string) ||
                  (obj.itemId as string) ||
                  (obj.sku as string);
                const qty = Number(obj.quantity ?? obj.qty ?? 1) || 1;
                if (pid) counts[pid] = (counts[pid] || 0) + qty;
              });
            }
          });
        });

        // fetch all products and map by id
        const prodQ = query(
          collection(db, "stocks"),
          orderBy("createdAt", "desc"),
        );
        const prodSnap = await getDocs(prodQ);
        const prods: ProductItem[] = prodSnap.docs.map((d) => {
          const data = d.data() as ProductDoc;
          return {
            id: d.id,
            name: (data.groupName as string) || (data.name as string),
            price:
              typeof data.unitPrice === "number"
                ? data.unitPrice
                : (data.price as number | undefined),
            image:
              ((data.colorVariants?.[0] as Record<string, unknown> | undefined)
                ?.image as string | undefined) ||
              (data.image as string | undefined) ||
              (data.groupImage as string | undefined),
            groupImage: data.groupImage as string | undefined,
            stock: (data.stock as number) || 0,
            createdAt:
              (data.createdAt as
                | Timestamp
                | number
                | Date
                | null
                | undefined) || null,
            salesCount: counts[d.id] || 0,
          };
        });

        // filter only those with sales and sort by salesCount desc
        const best = prods
          .filter((p) => (p.salesCount || 0) > 0)
          .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));

        setItems(best);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    switch (sortBy) {
      case "price_asc":
        return arr.sort((a, b) => (a.price || 0) - (b.price || 0));
      case "price_desc":
        return arr.sort((a, b) => (b.price || 0) - (a.price || 0));
      case "name_asc":
        return arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "name_desc":
        return arr.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      case "newest":
        return arr.sort((a, b) => {
          const toMs = (v: number | Timestamp | Date | null | undefined) => {
            if (!v) return 0;
            if (typeof v === "number") return v;
            if (v instanceof Date) return v.getTime();
            if (
              typeof v === "object" &&
              "toMillis" in v &&
              typeof (v as { toMillis?: unknown }).toMillis === "function"
            )
              return (v as { toMillis: () => number }).toMillis();
            if (
              typeof v === "object" &&
              "seconds" in v &&
              typeof (v as { seconds?: unknown }).seconds === "number"
            ) {
              const ts = v as { seconds: number; nanoseconds?: number };
              return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
            }
            return Number(new Date(String(v)).getTime()) || 0;
          };

          const ta = toMs(a.createdAt);
          const tb = toMs(b.createdAt);
          return tb - ta;
        });
      case "sales":
      default:
        return arr.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    }
  }, [items, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / itemsPerPage));
  const start = (currentPage - 1) * itemsPerPage;
  // --- search support: sync with URL and app:search events ---
  const searchParams = useSearchParams();
  const urlQuery = (searchParams?.get("q") || "").trim();
  const [localQuery, setLocalQuery] = useState<string>(urlQuery);

  useEffect(() => {
    setLocalQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const q = (e?.detail || "").toString();
      setLocalQuery((q || "").toString());
      setCurrentPage(1);
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

  const filteredItems = (
    localQuery
      ? sortedItems.filter((p) => {
          const q = localQuery.toLowerCase();
          const name = (p.name || "").toLowerCase();
          return name.includes(q);
        })
      : sortedItems
  ) as ProductItem[];

  const totalPagesFiltered = Math.max(
    1,
    Math.ceil(filteredItems.length / itemsPerPage),
  );
  const startFiltered = (currentPage - 1) * itemsPerPage;
  const visible = filteredItems.slice(
    startFiltered,
    startFiltered + itemsPerPage,
  );

  const { t } = useLanguage();

  if (loading)
    return (
      <div className="min-h-screen bg-white font-sans text-black">
        <main className="mx-auto max-w-6xl py-8">
          <section className="px-6">
            <h1 className="text-2xl font-serif text-center text-pink-400 mb-6 font-pacifico">
              {t("best_sellers")}
            </h1>

            <div className="border border-pink-300 my-6" />

            <div className="mx-auto max-w-xl text-center">
              <div className="flex items-center justify-center">
                <div className="h-12 w-12 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
              </div>
              <div className="mt-4 h-6 bg-gray-100 rounded w-48 mx-auto animate-pulse" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[5/8] bg-gray-100 rounded-md mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!items || items.length === 0)
    return <div className="p-6">No best sellers in the last 30 days.</div>;

  if (localQuery && (!filteredItems || filteredItems.length === 0)) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="text-lg md:text-xl font-medium text-gray-700">
          No items found for &quot;{localQuery}&quot;
        </div>
        <div className="mt-3 text-sm text-gray-500">
          Try a different search term or clear filters.
        </div>
      </div>
    );
  }

  const paginationItems: Array<number | "ellipsis"> = (() => {
    if (totalPagesFiltered <= 7) {
      return Array.from({ length: totalPagesFiltered }, (_, i) => i + 1);
    }

    const itemsList: Array<number | "ellipsis"> = [1];
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPagesFiltered - 1, currentPage + 1);

    if (startPage > 2) itemsList.push("ellipsis");
    for (let page = startPage; page <= endPage; page++) itemsList.push(page);
    if (endPage < totalPagesFiltered - 1) itemsList.push("ellipsis");

    itemsList.push(totalPagesFiltered);
    return itemsList;
  })();

  return (
    <div className="min-h-screen bg-white font-sans text-black">
      <main className="mx-auto max-w-6xl py-8">
        <section className="px-6">
          <h1 className="text-2xl font-serif text-center text-pink-400 mb-6 font-pacifico">
            Best Seller
          </h1>

          <div className="border border-pink-300 my-6" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="text-sm text-gray-600">
              {items.length} {t("best_sellers")}
            </div>
            <div className="text-sm">
              <div className="relative inline-flex items-center">
                <select
                  title="sortBy"
                  value={sortBy}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setSortBy(
                      e.target.value as
                        | "sales"
                        | "price_asc"
                        | "price_desc"
                        | "name_asc"
                        | "name_desc"
                        | "newest",
                    )
                  }
                  className="peer border border-gray-200 rounded px-2 py-1 text-sm bg-white appearance-none pr-8"
                >
                  <option value="sales">{t("sort_sales")}</option>
                  <option value="price_asc">{t("sort_price_asc")}</option>
                  <option value="price_desc">{t("sort_price_desc")}</option>
                  <option value="name_asc">{t("sort_name_asc")}</option>
                  <option value="name_desc">{t("sort_name_desc")}</option>
                  <option value="newest">{t("sort_newest")}</option>
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`} className="block">
                <div className="group bg-white hover:shadow-lg transition p-2">
                  <div className="aspect-[5/8] bg-gray-50 overflow-hidden mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image || p.groupImage}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {p.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {p.price ? `฿ ${p.price}` : "—"}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex w-full max-w-md items-center justify-between gap-2 rounded-full border border-gray-200 bg-gray-50 p-2 shadow-sm sm:hidden">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("prev")}
              </button>

              <span className="px-2 text-xs font-medium text-gray-600">
                {currentPage} / {totalPagesFiltered}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPagesFiltered, p + 1))
                }
                disabled={currentPage === totalPagesFiltered}
                className="h-9 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("next")}
              </button>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-gray-200 bg-gray-50 p-2 shadow-sm sm:inline-flex">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("prev")}
              </button>

              <div className="flex items-center gap-1">
                {paginationItems.map((item, idx) => {
                  if (item === "ellipsis") {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="inline-flex h-9 w-9 items-center justify-center text-sm text-gray-400"
                      >
                        ...
                      </span>
                    );
                  }

                  const page = item;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition ${
                        currentPage === page
                          ? "bg-pink-500 text-white shadow"
                          : "bg-white text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPagesFiltered, p + 1))
                }
                disabled={currentPage === totalPagesFiltered}
                className="h-9 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("next")}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Page {currentPage} of {totalPagesFiltered}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

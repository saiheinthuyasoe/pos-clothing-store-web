"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  const visible = sortedItems.slice(start, start + itemsPerPage);

  if (loading)
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-serif text-center text-gray-800 border-b pb-4 mb-6">
          Best Seller
        </h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[5/8] bg-gray-100 rounded-md mb-2" />
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!items || items.length === 0)
    return <div className="p-6">No best sellers in the last 30 days.</div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-serif text-center text-gray-800 border-b pb-4 mb-6">
        Best Seller
      </h1>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">Sort by</div>
        <div>
          <label className="sr-only">Sort by</label>
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
            className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="sales">Best Selling</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A–Z</option>
            <option value="name_desc">Name: Z–A</option>
            <option value="newest">Newest</option>
          </select>
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
              <div className="text-xs text-gray-500 mt-1">
                Sold: {p.salesCount}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-600">
          {items.length} best sellers (last 30 days)
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((s) => Math.max(1, s - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <div className="text-sm">
            {currentPage} / {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage((s) => Math.min(totalPages, s + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

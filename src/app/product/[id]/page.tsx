"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";
import ProductsList from "../../../components/ProductsList";

type SizeQuantity = { size?: string; quantity?: number | string };
type ColorVariant = {
  id?: string;
  color?: string;
  colorCode?: string;
  image?: string;
  sizeQuantities?: SizeQuantity[];
};
type Product = {
  id?: string;
  colorVariants?: ColorVariant[];
  stock?: number;
  groupName?: string;
  name?: string;
  unitPrice?: number | string;
  price?: number | string;
  groupImage?: string;
  image?: string;
  category?: string;
  description?: string;
  modelInfo?: string | number;
  [key: string]: unknown;
};

export default function ProductDetailPage() {
  const params = useParams() as { id?: string };
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [selectedSize, setSelectedSize] = useState<string>("");

  const variants: ColorVariant[] = (product && product.colorVariants) || [];
  const stockFromVariants = variants.reduce(
    (total: number, v: ColorVariant) =>
      total +
      (v.sizeQuantities || []).reduce(
        (t: number, s: SizeQuantity) => t + (Number(s.quantity) || 0),
        0,
      ),
    0,
  );
  const stock = product?.stock ?? stockFromVariants ?? 0;

  const displayName = (product && (product.groupName || product.name)) || "";
  const displayPrice: number | null = (() => {
    if (!product) return null;
    if (typeof product.unitPrice === "number") return product.unitPrice;
    if (typeof product.price === "number") return product.price;
    const parsed = Number(product.unitPrice ?? product.price);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  const getSizesForVariant = (vid?: string | null) => {
    if (!variants || variants.length === 0) return [] as SizeQuantity[];
    const v = variants.find(
      (x) => (x.id ?? x.color ?? String(x)) === vid || vid == null,
    );
    if (!v) return [] as SizeQuantity[];
    return (v.sizeQuantities || []) as SizeQuantity[];
  };

  const aggregateSizes = () => {
    const map: Record<string, number> = {};
    for (const v of variants) {
      (v.sizeQuantities || []).forEach((sq: SizeQuantity) => {
        const key = String(sq.size);
        map[key] = (map[key] || 0) + (Number(sq.quantity) || 0);
      });
    }
    return Object.keys(map).map((k) => ({ size: k, quantity: map[k] }));
  };

  // Do not show sizes until a color variant is selected
  const sizesToShow = selectedVariantId
    ? getSizesForVariant(selectedVariantId)
    : ([] as SizeQuantity[]);

  const selectedVariant = variants.find(
    (v) => String(v.id ?? v.color ?? String(v)) === String(selectedVariantId),
  );

  const mainImageSrc =
    selectedVariant?.image ||
    product?.groupImage ||
    product?.image ||
    (variants[0] && variants[0].image) ||
    `https://via.placeholder.com/400x600?text=${encodeURIComponent(
      displayName || "Product",
    )}`;

  const mmkRate = Number(process?.env?.NEXT_PUBLIC_MMK_RATE) || 55;
  const mmkPrice =
    displayPrice !== null ? Math.round(displayPrice * mmkRate) : null;

  const selectedQty = (() => {
    if (!selectedVariant) return 0;
    if (selectedSize) {
      const found = (selectedVariant.sizeQuantities || []).find(
        (s) => String(s.size) === String(selectedSize),
      );
      return Number(found?.quantity) || 0;
    }
    return (selectedVariant.sizeQuantities || []).reduce(
      (t, s) => t + (Number(s.quantity) || 0),
      0,
    );
  })();

  const selectedItemLabel = `${displayName}${selectedVariant?.color ? ` • ${selectedVariant.color}` : ""}${selectedSize ? ` • ${selectedSize}` : ""}`;

  // Touch swipe support for mobile: swipe image to change selected color
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const selectVariantByIndex = (index: number) => {
    if (!variants || variants.length === 0) return;
    const v = variants[Math.max(0, Math.min(index, variants.length - 1))];
    const vid = v.id ?? v.color ?? String(index);
    setSelectedVariantId(vid);
    setSelectedSize("");
  };

  const selectNextVariant = () => {
    if (!variants || variants.length === 0) return;
    const idx = variants.findIndex(
      (v) => String(v.id ?? v.color ?? String(v)) === String(selectedVariantId),
    );
    if (idx === -1) {
      selectVariantByIndex(0);
    } else {
      const next = idx + 1 >= variants.length ? 0 : idx + 1;
      selectVariantByIndex(next);
    }
  };

  const selectPrevVariant = () => {
    if (!variants || variants.length === 0) return;
    const idx = variants.findIndex(
      (v) => String(v.id ?? v.color ?? String(v)) === String(selectedVariantId),
    );
    if (idx === -1) {
      selectVariantByIndex(variants.length - 1);
    } else {
      const prev = idx - 1 < 0 ? variants.length - 1 : idx - 1;
      selectVariantByIndex(prev);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const dx = touchStartX.current - touchEndX.current;
    const threshold = 40; // px
    if (Math.abs(dx) > threshold) {
      if (dx > 0) {
        // swipe left -> next
        selectNextVariant();
      } else {
        // swipe right -> prev
        selectPrevVariant();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        if (!db) {
          setError("Firebase not configured");
          setLoading(false);
          return;
        }
        const ref = doc(db, "stocks", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError("Product not found");
          setLoading(false);
          return;
        }
        const data = snap.data();
        setProduct({ id: snap.id, ...data });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    // Do not auto-select a color on load. User must explicitly pick a color.
  }, [product?.id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!product) return <div className="p-6">No product</div>;

  return (
    <>
      <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="text-sm underline text-gray-700"
          >
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-1 md:[grid-template-columns:450px_1fr] gap-10 md:gap-20 items-start">
          <div>
            <div className="w-full bg-white overflow-visible flex items-center justify-center md:w-[450px] md:min-h-[550px] h-auto flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mainImageSrc}
                alt={displayName || "Product"}
                className="w-full h-auto md:w-[450px] md:max-h-[550px] object-contain"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />

              {/* Image navigation thumbnails (group image + variants) */}
              <div
                className="mt-3 flex items-start gap-3 overflow-x-auto pb-2 w-full max-w-full"
                style={{
                  touchAction: "pan-x",
                  WebkitOverflowScrolling: "touch",
                  overflowY: "hidden",
                  scrollbarWidth: "auto",
                }}
              >
                {/* group image thumbnail */}
                <button
                  onClick={() => {
                    setSelectedVariantId(null);
                    setSelectedSize("");
                  }}
                  aria-pressed={!selectedVariantId}
                  className={`flex flex-col items-center w-20 shrink-0`}
                >
                  <div
                    className={`w-16 h-16 rounded overflow-hidden border ${!selectedVariantId ? "border-[#7c4a32] shadow-sm" : "border-gray-200"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        product?.groupImage ||
                        product?.image ||
                        `https://via.placeholder.com/160x220?text=${encodeURIComponent(displayName || "Product")}`
                      }
                      alt={displayName || "Product"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Default</div>
                </button>

                {variants.map((v, idx) => {
                  const vid = v.id ?? v.color ?? String(idx);
                  const isActive = String(selectedVariantId) === String(vid);
                  return (
                    <button
                      key={vid}
                      onClick={() => {
                        setSelectedVariantId(vid);
                        setSelectedSize("");
                      }}
                      aria-pressed={isActive}
                      title={v.color}
                      className={`flex flex-col items-center w-20 shrink-0 inline-flex`}
                    >
                      <div
                        className={`w-16 h-16 rounded overflow-hidden border ${isActive ? "border-[#7c4a32] shadow-sm" : "border-gray-200"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            v.image ||
                            `https://via.placeholder.com/160x220?text=${encodeURIComponent(v.color || "")}`
                          }
                          alt={v.color}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {v.color}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="p-2 md:p-6 rounded md:col-span-1 md:pl-10">
            <div className="space-y-3">
              <div className="text-lg font-semibold text-gray-900">
                {displayName}
              </div>

              <div className="text-base text-gray-900">
                {displayPrice !== null ? (
                  <>
                    <span className="font-medium">
                      {Number.isInteger(displayPrice)
                        ? `฿ ${displayPrice.toFixed(0)}`
                        : `฿ ${displayPrice.toFixed(2)}`}
                    </span>
                    <span className="text-gray-500">{` / ${Math.round(
                      displayPrice *
                        (Number(process?.env?.NEXT_PUBLIC_MMK_RATE) || 55),
                    ).toLocaleString()} Ks`}</span>
                  </>
                ) : (
                  "—"
                )}
              </div>

              <div className="text-sm text-gray-600">
                <span className="text-xs text-gray-500">Category: </span>
                <span className="font-medium text-gray-900">
                  {product.category || product.description || "—"}
                </span>
              </div>

              <div>
                <div className="text-sm text-gray-700 mb-1">
                  <span>Color :</span>
                  <span className="font-medium text-gray-900 ml-2">
                    {selectedVariant?.color || ""}
                  </span>
                </div>
                <div
                  className="flex items-center gap-3 mb-3 mt-3 p-2 overflow-x-auto pb-2 whitespace-nowrap w-full max-w-full"
                  style={{
                    WebkitOverflowScrolling: "touch",
                    overflowY: "hidden",
                    scrollbarWidth: "auto",
                  }}
                >
                  {variants.length === 0 && (
                    <div className="text-xs text-gray-500">No colors</div>
                  )}
                  {variants.map((v, idx) => {
                    const vid = v.id ?? v.color ?? String(idx);
                    const isSelected =
                      String(selectedVariantId) === String(vid);
                    return (
                      <button
                        key={vid}
                        onClick={() => {
                          setSelectedVariantId(vid);
                          setSelectedSize("");
                        }}
                        title={v.color}
                        className={`w-7 h-7 rounded-full border-2 transition-all inline-flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "ring-2 ring-offset-1 ring-blue-300 border-transparent"
                            : "border-gray-300"
                        }`}
                        style={{ backgroundColor: v.colorCode || "#ddd" }}
                      />
                    );
                  })}
                </div>

                {/* Clear button placed below swatches so it doesn't scroll with them */}
                {selectedVariantId && (
                  <div className="mt-4 mb-4 ">
                    <button
                      onClick={() => {
                        setSelectedVariantId(null);
                        setSelectedSize("");
                      }}
                      className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded inline-flex"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* optional model info */}
                {product.modelInfo && (
                  <div className="text-sm text-gray-700 mb-2">
                    Model is size {product.modelInfo}
                  </div>
                )}

                <div className="text-sm text-gray-700 mb-2">
                  <span>Size :</span>
                  <span className="font-medium text-gray-900 ml-2">
                    {selectedSize || ""}
                  </span>
                </div>

                <div
                  className="flex gap-2 overflow-x-auto pb-2 whitespace-nowrap w-full max-w-full"
                  style={{
                    WebkitOverflowScrolling: "touch",
                    overflowY: "hidden",
                    scrollbarWidth: "auto",
                  }}
                >
                  {!selectedVariantId ? (
                    <div className="text-xs text-gray-500">
                      Select a color to view sizes
                    </div>
                  ) : (sizesToShow || []).length === 0 ? (
                    <div className="text-xs text-gray-500">No sizes</div>
                  ) : null}
                  {(sizesToShow || []).map((sq: SizeQuantity) => {
                    const qty = Number(sq.quantity) || 0;
                    const isSelected = selectedSize === String(sq.size);
                    return (
                      <button
                        key={String(sq.size)}
                        onClick={() =>
                          qty > 0 && setSelectedSize(String(sq.size))
                        }
                        disabled={qty === 0}
                        className={`px-3 py-2 border rounded text-sm transition-colors inline-flex ${
                          isSelected
                            ? "bg-[#7c4a32] text-white border-[#7c4a32]"
                            : qty === 0
                              ? "bg-white text-gray-400 border-gray-200 line-through opacity-60"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{String(sq.size)}</span>
                          <span className="text-xs text-gray-500">({qty})</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected item summary */}
                {selectedVariantId && selectedSize && (
                  <div className="mt-4 border-t pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        Selected Item:
                      </div>
                      <div className="text-sm font-medium text-right">
                        {selectedItemLabel}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">Price:</div>
                      <div className="text-sm font-medium text-right">
                        {mmkPrice !== null
                          ? `${mmkPrice.toLocaleString()} Ks`
                          : "—"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        Available Quantity
                      </div>
                      <div className="text-sm font-medium text-right">
                        {selectedQty}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
      {/* Suggested / New items list */}
      <div className="mt-10">
        <h2 className="text-2xl font-serif text-center text-gray-800 border-t pt-6 mb-6">
          Suggest Items
        </h2>
        <div className="max-w-[1100px] mx-auto pb-12">
          <ProductsList showOnlyNew itemsPerPageDefault={20} hideFilters />
        </div>
      </div>
    </>
  );
}

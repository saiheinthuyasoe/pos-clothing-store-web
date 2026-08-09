import type { Promotion } from "../hooks/usePromotions";

export type PromotionMatch = {
  promotion: Promotion;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
};

function computeDiscountAmount(
  price: number,
  promotion: Promotion,
): number {
  let discount =
    promotion.discountType === "percentage"
      ? (price * promotion.discountValue) / 100
      : promotion.discountValue;

  if (
    promotion.maxDiscountAmount !== undefined &&
    promotion.maxDiscountAmount > 0
  ) {
    discount = Math.min(discount, promotion.maxDiscountAmount);
  }

  // Never discount below zero or beyond the item's price
  return Math.max(0, Math.min(discount, price));
}

/**
 * Finds the best applicable promotion (if any) for a given stock/variant and
 * returns the resulting discounted price. Variant-scoped promotions and
 * group-scoped promotions are both considered; whichever yields the larger
 * discount amount wins.
 */
export function getBestPromotion(
  price: number,
  stockId: string | undefined,
  variantId: string | undefined | null,
  promotions: Promotion[] | undefined,
): PromotionMatch | null {
  if (!promotions || promotions.length === 0 || !stockId || !price) {
    return null;
  }

  const candidates = promotions.filter((p) => {
    if (p.stockId !== stockId) return false;
    if (p.scope === "variant") {
      return !!variantId && p.variantId === variantId;
    }
    return p.scope === "group";
  });

  if (candidates.length === 0) return null;

  let best: PromotionMatch | null = null;
  for (const promotion of candidates) {
    const discountAmount = computeDiscountAmount(price, promotion);
    if (discountAmount <= 0) continue;
    if (!best || discountAmount > best.discountAmount) {
      best = {
        promotion,
        originalPrice: price,
        discountedPrice: Math.max(0, price - discountAmount),
        discountAmount,
      };
    }
  }

  return best;
}

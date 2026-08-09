import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

export type PromotionScope = "group" | "variant";
export type PromotionDiscountType = "percentage" | "fixed";

export type Promotion = {
  id: string;
  name: string;
  scope: PromotionScope;
  stockId: string;
  stockName?: string;
  variantId?: string;
  variantColor?: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  startDate: string;
  endDate: string;
  description?: string;
  isActive: boolean;
};

/**
 * Fetch active promotions from Firestore with caching.
 * Filters out promotions that are disabled or outside their date range.
 */
export function usePromotions() {
  return useQuery({
    queryKey: ["promotions"],
    queryFn: async (): Promise<Promotion[]> => {
      if (!db) {
        return [];
      }

      const q = query(
        collection(db, "promotions"),
        where("isActive", "==", true),
      );
      const snap = await getDocs(q);

      // Compare using local zero-padded YYYY-MM-DD strings (not Date object
      // arithmetic) to avoid UTC/local timezone parsing mismatches, since
      // `new Date("YYYY-MM-DD")` parses as UTC midnight, which can shift the
      // effective day depending on the browser's timezone offset.
      const pad = (n: number) => String(n).padStart(2, "0");
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

      const promotions: Promotion[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name,
            scope: data.scope,
            stockId: data.stockId,
            stockName: data.stockName,
            variantId: data.variantId,
            variantColor: data.variantColor,
            discountType: data.discountType,
            discountValue: Number(data.discountValue) || 0,
            maxDiscountAmount:
              data.maxDiscountAmount !== undefined
                ? Number(data.maxDiscountAmount)
                : undefined,
            startDate: data.startDate,
            endDate: data.endDate,
            description: data.description,
            isActive: data.isActive ?? true,
          } as Promotion;
        })
        .filter((p) => {
          if (!p.startDate || !p.endDate) return false;
          return todayStr >= p.startDate && todayStr <= p.endDate;
        });

      return promotions;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
  });
}

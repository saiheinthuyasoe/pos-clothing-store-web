import { useQuery } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

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
  shop?: string;
  shopId?: string;
  branch?: string;
  [key: string]: unknown;
};

export type Product = {
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
  modelInfo?: string | number;
};

/**
 * Fetch all products from Firestore with caching
 * Cache duration: 3 minutes (product data should be relatively fresh)
 */
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      if (!db) {
        throw new Error("Firebase not configured");
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
                  (t: number, s: SizeQuantity) => t + (Number(s.quantity) || 0),
                  0,
                ),
              0,
            )
          : 0;

        // Determine if item is new
        let isNew = false;
        try {
          const created = data.createdAt;
          let createdMs = Date.now();
          if (created) {
            if (
              typeof created === "object" &&
              created !== null &&
              "toMillis" in created &&
              typeof (created as { toMillis?: unknown }).toMillis === "function"
            ) {
              createdMs = (created as { toMillis: () => number }).toMillis();
            } else if (typeof created === "number") {
              createdMs = created;
            } else {
              createdMs = new Date(String(created)).getTime();
            }
          }
          isNew = Date.now() - createdMs <= NEW_DAYS * MS_PER_DAY;
        } catch (e) {
          isNew = false;
        }

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
            data.shop?.toString() ||
            data.shopId?.toString() ||
            data.branch?.toString() ||
            "",
          createdAt: data.createdAt || null,
          isNew,
        };
      });

      return items;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Fetch a single product by ID
 * Cache duration: 5 minutes
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: async (): Promise<Product | null> => {
      if (!db || !id) {
        return null;
      }

      const docRef = doc(db, "stocks", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data() as FirestoreStockDoc;
      const colorVariants = (data.colorVariants as ColorVariant[]) || [];

      const stockFromVariants = Array.isArray(colorVariants)
        ? colorVariants.reduce(
            (total: number, v: ColorVariant) =>
              total +
              (v.sizeQuantities || []).reduce(
                (t: number, s: SizeQuantity) => t + (Number(s.quantity) || 0),
                0,
              ),
            0,
          )
        : 0;

      return {
        id: docSnap.id,
        name: data.groupName || data.name,
        price: typeof data.unitPrice === "number" ? data.unitPrice : data.price,
        description: data.category || data.description,
        image: data.colorVariants?.[0]?.image || data.image || data.groupImage,
        groupImage: data.groupImage,
        colorVariants: colorVariants,
        stock: data.stock || stockFromVariants || 0,
        shop:
          data.shop?.toString() ||
          data.shopId?.toString() ||
          data.branch?.toString() ||
          "",
        createdAt: data.createdAt || null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!id, // Only run query if ID is provided
  });
}

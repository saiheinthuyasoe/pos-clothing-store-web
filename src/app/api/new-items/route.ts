import { NextResponse } from "next/server";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

interface StockData {
  groupImage?: string;
  colorVariants?: Array<{ image?: string }>;
  image?: string;
  createdAt?: { toMillis?: () => number } | number | string | Date;
  groupName?: string;
  name?: string;
}

export async function GET() {
  try {
    const fallback = [
      {
        id: "fallback-1",
        name: "Sample Tee — Ocean",
        image: "https://via.placeholder.com/800x360.png?text=Sample+1",
      },
      {
        id: "fallback-2",
        name: "Sample Shirt — Sand",
        image: "https://via.placeholder.com/800x360.png?text=Sample+2",
      },
      {
        id: "fallback-3",
        name: "New Jacket — Slate",
        image: "https://via.placeholder.com/800x360.png?text=Sample+3",
      },
      {
        id: "fallback-4",
        name: "Limited Hoody — Charcoal",
        image: "https://via.placeholder.com/800x360.png?text=Sample+4",
      },
    ];

    if (!db) {
      // Firestore not configured locally — return development fallback items
      return NextResponse.json({ items: fallback });
    }
    // Query recent stock groups (owner app stores items in 'stocks')
    const q = query(
      collection(db, "stocks"),
      orderBy("createdAt", "desc"),
      limit(4)
    );
    const snapshot = await getDocs(q);

    const NEW_DAYS = Number(process.env.NEXT_PUBLIC_NEW_ITEM_DAYS || 7);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const items = snapshot.docs.map((doc) => {
      const data = doc.data() as StockData;
      // prefer: groupImage -> color variant image -> product image
      const image =
        data?.groupImage ||
        data?.colorVariants?.[0]?.image ||
        data?.image ||
        "";

      // compute isNew based on createdAt (supports Firestore Timestamp)
      let createdMs = Date.now();
      try {
        const created: StockData["createdAt"] = data?.createdAt;
        if (created) {
          if (
            typeof (created as { toMillis?: unknown }).toMillis === "function"
          )
            createdMs = (created as { toMillis: () => number }).toMillis();
          else if (typeof created === "number") createdMs = created;
          else createdMs = new Date(created as string | Date).getTime();
        }
      } catch (e) {
        createdMs = Date.now();
      }

      const isNew = Date.now() - createdMs <= NEW_DAYS * MS_PER_DAY;

      return {
        id: doc.id,
        name: data.groupName || data.name || "",
        image,
        groupImage: data.groupImage || "",
        isNew,
      };
    });

    // If no items found and we're running in development, return fallback samples
    if (!items.length && process.env.NODE_ENV !== "production") {
      return NextResponse.json({ items: fallback });
    }

    return NextResponse.json({ items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { items: [], error: msg || "Failed to fetch new items" },
      { status: 500 }
    );
  }
}

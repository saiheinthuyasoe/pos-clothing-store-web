import { NextResponse } from "next/server";

// Proxy GET /api/shops -> upstream shops API (default http://localhost:3000/api/shops)
export async function GET() {
  try {
    const upstreamUrl =
      process.env.SHOPS_API_URL ||
      process.env.NEXT_PUBLIC_SHOPS_API_URL ||
      "http://localhost:3000/api/shops";

    const upstream = await fetch(upstreamUrl);
    const data = await upstream.json().catch(() => null);
    const status = upstream.status || 200;
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("Error proxying /api/shops:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shops" },
      { status: 500 }
    );
  }
}

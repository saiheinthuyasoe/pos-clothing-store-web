import { NextResponse } from "next/server";

// Proxy GET /api/settings -> http://localhost:3001/api/settings
export async function GET() {
  try {
    const upstreamUrl =
      process.env.SETTINGS_API_URL ||
      process.env.NEXT_PUBLIC_SETTINGS_API_URL || "";

    const upstream = await fetch(upstreamUrl);
    const data = await upstream.json().catch(() => null);
    const status = upstream.status || 200;
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("Error proxying /api/settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

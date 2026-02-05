// app/api/rpc/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.text();

    // Use your env var (you set NEXT_PUBLIC_RPC_URL to Alchemy)
    const upstream = process.env.NEXT_PUBLIC_RPC_URL;
    if (!upstream) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_RPC_URL" }, { status: 500 });
    }

    const r = await fetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      // IMPORTANT: no caching
      cache: "no-store",
    });

    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/json",
        // Allow browser
        "access-control-allow-origin": "*",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "RPC proxy error" }, { status: 500 });
  }
}

// Optional preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

// app/api/rpc/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * The node behind a chain name. Callers pick a chain by name and never supply
 * a URL, so this proxy cannot be pointed at arbitrary hosts.
 */
function upstreamFor(chain: string | null): string | undefined {
  if (chain === "robinhood") {
    // The public Robinhood node sometimes sends its CORS header twice, which
    // browsers reject, so the browser reads that chain through here.
    return (
      process.env.RH_RPC_UPSTREAM ||
      process.env.NEXT_PUBLIC_RH_RPC_URL ||
      "https://rpc.mainnet.chain.robinhood.com"
    );
  }
  // Use your env var (you set NEXT_PUBLIC_RPC_URL to Alchemy)
  return process.env.NEXT_PUBLIC_RPC_URL;
}

export async function POST(req: Request) {
  try {
    const body = await req.text();

    const upstream = upstreamFor(new URL(req.url).searchParams.get("chain"));
    if (!upstream) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_RPC_URL" }, { status: 500 });
    }

    const r = await fetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      // IMPORTANT: no caching
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
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

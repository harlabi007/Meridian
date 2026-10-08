import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiFail } from "@/lib/apiError";
import { fetchPoolTrades } from "@/lib/events";
import { getConnection } from "@/lib/solana";

export const dynamic = "force-dynamic";

/**
 * Recent trades for a pool: real decoded swap events when available (exact side, trader and
 * amounts), falling back to stored price snapshots if the event feed is empty or unavailable.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("pool");
  if (!address) return apiError(400, "BAD_REQUEST", "Missing ?pool= address.");

  try {
    const trades = await fetchPoolTrades(address, getConnection());
    if (trades.length > 0) return NextResponse.json({ source: "events", trades });
  } catch (err) {
    console.warn("[api:trades] event feed unavailable, using snapshots:", err instanceof Error ? err.message : err);
  }

  try {
    const snapshots = await prisma.snapshot.findMany({
      where: { poolAddress: address },
      orderBy: { takenAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
      source: "snapshots",
      snapshots: snapshots.map((s) => ({
        priceQuote: s.priceQuote,
        progressPct: s.progressPct,
        takenAt: s.takenAt.toISOString(),
      })),
    });
  } catch (err) {
    return apiFail(err, "trades:GET");
  }
}

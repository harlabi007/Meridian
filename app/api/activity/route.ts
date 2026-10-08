import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiFail } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export interface ActivityItem {
  id: string;
  kind: "launch" | "trade";
  poolAddress: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceQuote: number;
  progressPct: number;
  at: string;
}

/**
 * A single, cross-pool feed for the homepage ticker. Built from snapshot deltas rather than
 * live event-parsing every pool on every request (which would mean one RPC round trip per
 * pool per page load) — cheap enough to poll every few seconds, at the cost of merging
 * same-block trades into one row. Real per-trade detail is still available on each pool's page.
 */
export async function GET() {
  try {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const [pools, snaps] = await Promise.all([
      prisma.pool.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { address: true, name: true, symbol: true, imageUrl: true, createdAt: true, priceQuote: true, progressPct: true },
      }),
      prisma.snapshot.findMany({
        where: { takenAt: { gte: since } },
        orderBy: { takenAt: "desc" },
        take: 300,
        select: { poolAddress: true, priceQuote: true, progressPct: true, takenAt: true, quoteReserve: true },
      }),
    ]);
    const byAddr = new Map(pools.map((p) => [p.address, p]));

    const items: ActivityItem[] = [];
    for (const p of pools) {
      items.push({
        id: `launch:${p.address}`,
        kind: "launch",
        poolAddress: p.address,
        name: p.name,
        symbol: p.symbol,
        imageUrl: p.imageUrl,
        priceQuote: p.priceQuote,
        progressPct: p.progressPct,
        at: p.createdAt.toISOString(),
      });
    }
    const byPool = new Map<string, typeof snaps>();
    for (const s of snaps) byPool.set(s.poolAddress, [...(byPool.get(s.poolAddress) ?? []), s]);
    for (const [addr, rows] of byPool) {
      const pool = byAddr.get(addr);
      if (!pool) continue;
      for (let i = 0; i < rows.length - 1; i++) {
        const a = rows[i]!, b = rows[i + 1]!;
        if (Math.abs(a.quoteReserve - b.quoteReserve) < 1e-9) continue;
        items.push({
          id: `trade:${addr}:${a.takenAt.getTime()}`,
          kind: "trade",
          poolAddress: addr,
          name: pool.name,
          symbol: pool.symbol,
          imageUrl: pool.imageUrl,
          priceQuote: a.priceQuote,
          progressPct: a.progressPct,
          at: a.takenAt.toISOString(),
        });
      }
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return NextResponse.json({ items: items.slice(0, 25) });
  } catch (err) {
    return apiFail(err, "activity:GET");
  }
}

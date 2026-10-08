import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiFail } from "@/lib/apiError";
import { fetchPoolState } from "@/lib/dbc";
import { syncPool, syncStale } from "@/lib/sync";
import { priceChangePct, sumAbsDeltas } from "@/lib/volume";
import type { PoolSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sort = req.nextUrl.searchParams.get("sort") ?? "recent";
    const creator = req.nextUrl.searchParams.get("creator");

    const orderBy =
      sort === "progress"
        ? { progressPct: "desc" as const }
        : sort === "marketcap"
        ? { marketCapQuote: "desc" as const }
        : { createdAt: "desc" as const };
    const query = { where: creator ? { creator } : undefined, orderBy, take: 100 };

    let pools = await prisma.pool.findMany(query);
    // Refresh stale rows straight from the chain so the site is live without the background indexer
    if (await syncStale(pools).catch(() => false)) pools = await prisma.pool.findMany(query);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snaps = pools.length
      ? await prisma.snapshot.findMany({
          where: { poolAddress: { in: pools.map((p) => p.address) }, takenAt: { gte: since } },
          orderBy: [{ poolAddress: "asc" }, { takenAt: "asc" }],
          select: { poolAddress: true, quoteReserve: true, priceQuote: true },
          take: 20_000,
        })
      : [];
    const byPool = new Map<string, { quoteReserve: number; priceQuote: number }[]>();
    for (const s of snaps) {
      const list = byPool.get(s.poolAddress) ?? [];
      list.push({ quoteReserve: s.quoteReserve, priceQuote: s.priceQuote });
      byPool.set(s.poolAddress, list);
    }

    const summaries: PoolSummary[] = pools.map((p) => ({
      address: p.address,
      baseMint: p.baseMint,
      quoteMint: p.quoteMint,
      name: p.name,
      symbol: p.symbol,
      imageUrl: p.imageUrl,
      creator: p.creator,
      createdAt: p.createdAt.toISOString(),
      progressPct: p.progressPct,
      priceQuote: p.priceQuote,
      marketCapQuote: p.marketCapQuote,
      quoteReserve: p.quoteReserve,
      migrationThresholdQuote: p.migrationThresholdQuote,
      volume24hQuote: sumAbsDeltas(byPool.get(p.address) ?? []),
      priceChangePct24h: priceChangePct(p.priceQuote, byPool.get(p.address) ?? []),
      migrated: p.migrated,
      migratedTo: (p.migratedTo as "damm_v1" | "damm_v2" | null) ?? null,
    }));

    return NextResponse.json({ pools: summaries });
  } catch (err) {
    return apiFail(err, "pools:GET");
  }
}

const b58 = z.string().refine((v) => {
  try {
    new PublicKey(v);
    return true;
  } catch {
    return false;
  }
}, "Invalid address");

const registerSchema = z.object({
  address: b58,
  configAddress: b58,
  baseMint: b58,
  quoteMint: b58,
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  imageUrl: z.string().url().max(500).startsWith("https://").nullable().optional(),
  creator: b58,
  baseDecimals: z.number().int().min(0).max(12).default(6),
  quoteDecimals: z.number().int().min(0).max(12).default(9),
  totalSupply: z.number().positive(),
  migrationThresholdQuote: z.number().nonnegative().default(0),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Registers a freshly launched pool. The pool is verified ON-CHAIN first (it must exist and
 * be created by the claimed wallet), so nobody can list fake tokens by calling this directly.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "BAD_REQUEST", "Request body must be JSON.");
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "BAD_REQUEST", `Invalid pool data: ${parsed.error.issues[0]?.message ?? "check the fields"}.`);
  }
  const d = parsed.data;

  try {
    // The RPC node may be a moment behind the wallet's; retry briefly before giving up
    let state = null;
    for (let attempt = 0; attempt < 4 && !state; attempt++) {
      state = await fetchPoolState(d.address).catch(() => null);
      if (!state) await sleep(1200);
    }
    if (!state) {
      return apiError(409, "POOL_NOT_FOUND_ON_CHAIN", "That pool isn't visible on-chain yet. It will be retried automatically.");
    }
    const onChainCreator = (state.pool as any).creator?.toBase58?.();
    if (onChainCreator && onChainCreator !== d.creator) {
      return apiError(403, "FORBIDDEN", "The pool wasn't created by that wallet.");
    }

    await prisma.pool.upsert({
      where: { address: d.address },
      update: {},
      create: {
        address: d.address,
        configAddress: d.configAddress,
        baseMint: d.baseMint,
        quoteMint: d.quoteMint,
        name: d.name,
        symbol: d.symbol,
        imageUrl: d.imageUrl ?? null,
        creator: d.creator,
        baseDecimals: d.baseDecimals,
        quoteDecimals: d.quoteDecimals,
        totalSupply: d.totalSupply,
        migrationThresholdQuote: d.migrationThresholdQuote,
      },
    });
    const synced = await syncPool(d.address).catch(() => null);
    return NextResponse.json({ ok: true, pool: synced?.row ?? null });
  } catch (err) {
    return apiFail(err, "pools:POST");
  }
}

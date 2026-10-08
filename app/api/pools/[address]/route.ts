import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiFail } from "@/lib/apiError";
import { estimateHolderCount } from "@/lib/creator";
import { modelFromSegments, segmentsFromSdkConfig } from "@/lib/curve";
import { syncPool } from "@/lib/sync";
import { priceChangePct, sumAbsDeltas } from "@/lib/volume";
import { imageEditMessage } from "@/lib/messages";
import { verifyWalletSignature } from "@/lib/verify";
import type { PoolDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  try {
    const existing = await prisma.pool.findUnique({ where: { address: params.address } });
    if (!existing) return apiError(404, "NOT_FOUND", "This pool isn't in Meridian's database.");

    // Pull live state from the chain (best effort: fall back to the stored row if the RPC is busy)
    const synced = await syncPool(params.address).catch(() => null);
    const p = synced?.row ?? existing;

    let curvePoints: PoolDetail["curvePoints"] = [];
    if (synced?.state) {
      try {
        const segs = segmentsFromSdkConfig(synced.state.config as any, p.baseDecimals, p.quoteDecimals);
        curvePoints = modelFromSegments(segs, p.totalSupply, "sdk")?.points ?? [];
      } catch {
        curvePoints = [];
      }
    }

    let holderCount = 0;
    try {
      holderCount = await estimateHolderCount(p.baseMint);
    } catch {
      holderCount = 0;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snaps = await prisma.snapshot.findMany({
      where: { poolAddress: p.address, takenAt: { gte: since } },
      orderBy: { takenAt: "asc" },
      select: { quoteReserve: true, priceQuote: true },
      take: 5000,
    });

    const detail: PoolDetail = {
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
      volume24hQuote: sumAbsDeltas(snaps),
      priceChangePct24h: priceChangePct(p.priceQuote, snaps),
      migrated: p.migrated,
      migratedTo: (p.migratedTo as "damm_v1" | "damm_v2" | null) ?? null,
      baseDecimals: p.baseDecimals,
      quoteDecimals: p.quoteDecimals,
      totalSupply: p.totalSupply,
      circulatingSupply: p.totalSupply,
      curvePoints,
      holderCount,
    };
    return NextResponse.json({ pool: detail });
  } catch (err) {
    return apiFail(err, "pool:GET");
  }
}

// ---- Creator edits: authenticated with a wallet signature, not just a claimed address ----
// Either a pasted https:// link, or an uploaded image encoded as a data URL (the client resizes
// it to ~256px/JPEG before sending — see lib/imageUpload.ts — so 300KB comfortably covers it).
const imageUrlSchema = z
  .string()
  .max(300_000)
  .refine((v) => v.startsWith("https://") || v.startsWith("data:image/"), {
    message: "Use an https:// link or an uploaded image.",
  });

const patchSchema = z.object({
  creator: z.string(),
  imageUrl: imageUrlSchema,
  timestamp: z.number(),
  signature: z.string().min(1),
});

export async function PATCH(req: NextRequest, { params }: { params: { address: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "BAD_REQUEST", "Request body must be JSON.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "BAD_REQUEST", "Provide an https:// image URL and a wallet signature.");
  const { creator, imageUrl, timestamp, signature } = parsed.data;

  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return apiError(400, "BAD_REQUEST", "The signature has expired. Please sign again.");
  }
  try {
    const pool = await prisma.pool.findUnique({ where: { address: params.address } });
    if (!pool) return apiError(404, "NOT_FOUND", "Pool not found.");
    if (creator !== pool.creator) return apiError(403, "FORBIDDEN", "Only the pool creator can edit this.");

    let pk: PublicKey;
    try {
      pk = new PublicKey(creator);
    } catch {
      return apiError(400, "BAD_REQUEST", "Invalid creator address.");
    }
    if (!verifyWalletSignature(pk, imageEditMessage(params.address, imageUrl, timestamp), signature)) {
      return apiError(403, "FORBIDDEN", "The wallet signature didn't verify.");
    }
    const updated = await prisma.pool.update({ where: { address: params.address }, data: { imageUrl } });
    return NextResponse.json({ ok: true, imageUrl: updated.imageUrl });
  } catch (err) {
    return apiFail(err, "pool:PATCH");
  }
}

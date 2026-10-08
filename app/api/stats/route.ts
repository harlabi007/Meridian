import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiFail } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [totalPools, migratedCount, agg] = await Promise.all([
      prisma.pool.count(),
      prisma.pool.count({ where: { migrated: true } }),
      prisma.pool.aggregate({ _sum: { marketCapQuote: true, quoteReserve: true } }),
    ]);
    return NextResponse.json({
      totalPools,
      migratedCount,
      totalMarketCapQuote: agg._sum.marketCapQuote ?? 0,
      totalRaisedQuote: agg._sum.quoteReserve ?? 0,
    });
  } catch (err) {
    return apiFail(err, "stats:GET");
  }
}

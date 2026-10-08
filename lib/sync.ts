import { prisma } from "./db";
import { fetchPoolState, sqrtPriceToPrice } from "./dbc";

/**
 * Keeps a pool's DB row in step with its on-chain state. Called from the API routes
 * whenever a row is stale, so the site stays live even if the optional background
 * indexer (scripts/indexer.ts) isn't running.
 */
const STALE_MS = 30_000;
const FAIL_BACKOFF_MS = 20_000;
const inFlight = new Map<string, Promise<SyncResult | null>>();
const lastFail = new Map<string, number>();

type State = NonNullable<Awaited<ReturnType<typeof fetchPoolState>>>;
export interface SyncResult {
  row: NonNullable<Awaited<ReturnType<typeof prisma.pool.findUnique>>>;
  state: State | null;
}

export function syncPool(address: string): Promise<SyncResult | null> {
  const running = inFlight.get(address);
  if (running) return running;
  const p = doSync(address).finally(() => inFlight.delete(address));
  inFlight.set(address, p);
  return p;
}

async function doSync(address: string): Promise<SyncResult | null> {
  const row = await prisma.pool.findUnique({ where: { address } });
  if (!row) return null;

  let state: State | null = null;
  try {
    state = await fetchPoolState(address);
  } catch (err) {
    lastFail.set(address, Date.now());
    throw err;
  }
  if (!state) {
    lastFail.set(address, Date.now());
    return { row, state: null };
  }

  const { pool, config } = state;
  const bd = row.baseDecimals;
  const qd = row.quoteDecimals;
  const priceQuote = sqrtPriceToPrice(pool.sqrtPrice, bd, qd);
  const quoteReserve = Number(pool.quoteReserve.toString()) / 10 ** qd;
  const baseReserve = Number(pool.baseReserve.toString()) / 10 ** bd;
  // The real SOL needed to graduate, read from the on-chain config (not the market-cap input)
  const threshold = Number(config.migrationQuoteThreshold.toString()) / 10 ** qd;
  const progressPct = threshold > 0 ? Math.min(100, (quoteReserve / threshold) * 100) : 0;
  const migrated = Number(pool.isMigrated) === 1 || (pool.isMigrated as unknown) === true;

  const updated = await prisma.pool.update({
    where: { address },
    data: {
      priceQuote,
      quoteReserve,
      progressPct: migrated ? 100 : progressPct,
      marketCapQuote: priceQuote * row.totalSupply,
      migrationThresholdQuote: threshold || row.migrationThresholdQuote,
      migrated,
    },
  });

  // Only store a snapshot when something moved, so history stays meaningful and small
  if (Math.abs(quoteReserve - row.quoteReserve) > 1e-12 || priceQuote !== row.priceQuote) {
    await prisma.snapshot.create({
      data: { poolAddress: address, priceQuote, quoteReserve, baseReserve, progressPct },
    });
  }
  lastFail.delete(address);
  return { row: updated, state };
}

/** Refreshes any stale, un-migrated rows (bounded). Returns true if anything was updated. */
export async function syncStale(
  rows: { address: string; updatedAt: Date; migrated: boolean }[],
  max = 12
): Promise<boolean> {
  const now = Date.now();
  const due = rows
    .filter(
      (r) =>
        !r.migrated &&
        now - r.updatedAt.getTime() > STALE_MS &&
        now - (lastFail.get(r.address) ?? 0) > FAIL_BACKOFF_MS
    )
    .slice(0, max);
  if (due.length === 0) return false;
  const results = await Promise.allSettled(
    due.map((r) =>
      syncPool(r.address).catch((e) => {
        lastFail.set(r.address, Date.now());
        throw e;
      })
    )
  );
  return results.some((r) => r.status === "fulfilled" && r.value !== null);
}

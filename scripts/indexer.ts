/**
 * Polling indexer for Meridian.
 *
 * Run continuously alongside the web app: `npm run indexer`
 *
 * What it does, every POLL_INTERVAL_MS:
 *   1. Fetches every virtual pool from the DBC program via client.state.getPools()
 *   2. For each, reads its config (for decimals + migration threshold) and
 *      computes price/market cap/progress from the live sqrt-price
 *   3. Upserts the pool row and appends a Snapshot row for history/volume
 *
 * This is intentionally a polling design rather than a websocket log
 * subscriber — much simpler to run reliably for a hackathon demo, at the
 * cost of not capturing individual trade sides/amounts. Swap out for
 * `connection.onLogs(DBC_PROGRAM_ID, ...)` + Anchor event parsing to get
 * exact per-trade data in a production build.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getConnection } from "../lib/solana";
import { getDbcClient, sqrtPriceToPrice } from "../lib/dbc";

const POLL_INTERVAL_MS = Number(process.env.INDEXER_POLL_MS ?? 15_000);
const prisma = new PrismaClient();

async function pollOnce() {
  const connection = getConnection();
  const client = getDbcClient(connection);

  const pools = await client.state.getPools();
  console.log(`[indexer] fetched ${pools.length} pools`);

  for (const { publicKey, account: pool } of pools) {
    try {
      const config = await client.state.getPoolConfig(pool.config);
      const baseDecimals = config.tokenDecimal ?? 6;
      const quoteDecimals = 9; // SOL

      const priceQuote = sqrtPriceToPrice(pool.sqrtPrice, baseDecimals, quoteDecimals);
      const quoteReserve = Number(pool.quoteReserve.toString()) / 10 ** quoteDecimals;
      const baseReserve = Number(pool.baseReserve.toString()) / 10 ** baseDecimals;
      const migrationThresholdQuote =
        Number(config.migrationQuoteThreshold.toString()) / 10 ** quoteDecimals;
      const progressPct = migrationThresholdQuote
        ? Math.min(100, (quoteReserve / migrationThresholdQuote) * 100)
        : 0;
      const totalSupply = Number(config.tokenSupply?.preMigrationTokenSupply?.toString() ?? 0) / 10 ** baseDecimals;
      const marketCapQuote = priceQuote * (totalSupply || 0);

      const address = publicKey.toBase58();

      const existing = await prisma.pool.findUnique({ where: { address } });
      if (!existing) {
        // Pool metadata (name/symbol/creator/mints) is set once at creation
        // time by the app itself (see app/api routes triggered post-mint).
        // If the indexer discovers a pool the app didn't record (e.g.
        // created outside this app), skip it rather than guess metadata.
        continue;
      }

      await prisma.pool.update({
        where: { address },
        data: {
          priceQuote,
          quoteReserve,
          progressPct,
          marketCapQuote,
          migrated: pool.isMigrated === 1,
        },
      });

      await prisma.snapshot.create({
        data: { poolAddress: address, priceQuote, quoteReserve, baseReserve, progressPct },
      });
    } catch (err) {
      console.error(`[indexer] failed to process pool ${publicKey.toBase58()}:`, err);
    }
  }
}

async function main() {
  console.log(`[indexer] starting, poll interval ${POLL_INTERVAL_MS}ms`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await pollOnce().catch((err) => console.error("[indexer] poll failed:", err));
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

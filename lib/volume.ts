/**
 * 24h volume estimate: the sum of absolute changes in a pool's quote reserve between
 * consecutive snapshots. Buys and sells both move the reserve, so this tracks real
 * activity far better than a single first-vs-last comparison (where buys and sells cancel).
 * It is still an estimate: trades that land between two snapshots are netted together.
 */
export function sumAbsDeltas(rows: { quoteReserve: number }[]): number {
  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    total += Math.abs(rows[i]!.quoteReserve - rows[i - 1]!.quoteReserve);
  }
  return total;
}

/** % change from the oldest snapshot in the window to the current price. null if no history yet. */
export function priceChangePct(currentPrice: number, rows: { priceQuote: number }[]): number | null {
  const first = rows[0];
  if (!first || !(first.priceQuote > 0)) return null;
  return ((currentPrice - first.priceQuote) / first.priceQuote) * 100;
}

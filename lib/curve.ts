import type { CurvePoint } from "./types";

/**
 * Bonding-curve model, in UI units (SOL per token, whole tokens).
 *
 * A DBC curve is a list of constant-liquidity segments. Inside a segment with
 * liquidity `l`, moving the sqrt-price from `sa` to `sb`:
 *   quote paid  = l * (sb - sa)
 *   base sold   = l * (1/sa - 1/sb)
 *   price       = sqrtPrice^2
 * Progress toward graduation = quote raised / total quote needed to graduate.
 */
export interface Segment {
  sa: number;
  sb: number;
  l: number;
}

export interface CurveModel {
  /** "sdk" = derived from Meridian's real launch config; "estimate" = simplified fallback */
  source: "sdk" | "estimate";
  segments: Segment[];
  totalSupply: number;
  startPrice: number;
  migrationPrice: number;
  priceMultiple: number;
  tokensOnCurve: number;
  quoteToGraduate: number;
  points: CurvePoint[];
}

const Q64 = 2 ** 64;

/**
 * Raw on-chain curve entries (sqrt prices and liquidity as plain numbers) -> UI-unit segments.
 *
 * DBC's on-chain `curve` array is fixed-size and padded: real segments are followed by a
 * sentinel entry at (or near) the protocol's MAX_SQRT_PRICE — not a real price point — then
 * zero-filled slots. Confirmed directly from a live pool's data: the sentinel's sqrt-price is
 * ~7.9e28, which read as a real segment produced an absurd multi-quadrillion-SOL price. Passing
 * `stopAtSqrtRaw` (the config's own `migrationSqrtPrice`) truncates processing at the real last
 * segment instead of trusting "positive liquidity + increasing price" alone to identify it.
 */
export function rawToSegments(
  startSqrtRaw: number,
  entries: { sqrtRaw: number; liquidityRaw: number }[],
  baseDecimals: number,
  quoteDecimals: number,
  stopAtSqrtRaw?: number
): Segment[] {
  const k = 10 ** ((baseDecimals - quoteDecimals) / 2);
  const segs: Segment[] = [];
  let prev = startSqrtRaw;
  for (const e of entries) {
    // Unused trailing slots on-chain have zero liquidity / non-increasing price: skip them
    if (!(e.liquidityRaw > 0) || !(e.sqrtRaw > prev)) continue;
    const reachedEnd = stopAtSqrtRaw !== undefined && prev >= stopAtSqrtRaw;
    if (reachedEnd) break;
    // Clamp the final segment's endpoint to the real migration price rather than a sentinel
    const sqrtRaw = stopAtSqrtRaw !== undefined ? Math.min(e.sqrtRaw, stopAtSqrtRaw) : e.sqrtRaw;
    segs.push({
      sa: prev * k,
      sb: sqrtRaw * k,
      l: e.liquidityRaw / (k * 10 ** quoteDecimals),
    });
    prev = sqrtRaw;
    if (stopAtSqrtRaw !== undefined && prev >= stopAtSqrtRaw) break;
  }
  return segs;
}

/** Accepts BN-like values (anything with toString()) from the SDK's curve config. */
export function segmentsFromSdkConfig(
  cfg: {
    sqrtStartPrice: { toString(): string };
    migrationSqrtPrice?: { toString(): string };
    curve?: { sqrtPrice: { toString(): string }; liquidity: { toString(): string } }[];
  },
  baseDecimals: number,
  quoteDecimals: number
): Segment[] {
  return rawToSegments(
    Number(cfg.sqrtStartPrice.toString()) / Q64,
    (cfg.curve ?? []).map((c) => ({
      sqrtRaw: Number(c.sqrtPrice.toString()) / Q64,
      // liquidity is stored scaled by 2^64 as well
      liquidityRaw: Number(c.liquidity.toString()) / Q64,
    })),
    baseDecimals,
    quoteDecimals,
    cfg.migrationSqrtPrice ? Number(cfg.migrationSqrtPrice.toString()) / Q64 : undefined
  );
}

function totals(segments: Segment[]) {
  let quote = 0;
  let base = 0;
  for (const s of segments) {
    quote += s.l * (s.sb - s.sa);
    base += s.l * (1 / s.sa - 1 / s.sb);
  }
  return { quote, base };
}

/** Sqrt-price and cumulative base sold once `q` quote has been paid into the curve. */
function locate(segments: Segment[], q: number): { s: number; base: number } {
  let remaining = q;
  let base = 0;
  for (const seg of segments) {
    const segQuote = seg.l * (seg.sb - seg.sa);
    if (remaining <= segQuote) {
      const s = seg.sa + remaining / seg.l;
      return { s, base: base + seg.l * (1 / seg.sa - 1 / s) };
    }
    remaining -= segQuote;
    base += seg.l * (1 / seg.sa - 1 / seg.sb);
  }
  const last = segments[segments.length - 1]!;
  return { s: last.sb, base };
}

export function modelFromSegments(
  segments: Segment[],
  totalSupply: number,
  source: CurveModel["source"]
): CurveModel | null {
  if (segments.length === 0) return null;
  const { quote, base } = totals(segments);
  if (!(quote > 0) || !(base > 0)) return null;

  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  const startPrice = first.sa * first.sa;
  const migrationPrice = last.sb * last.sb;

  const points: CurvePoint[] = [];
  const steps = 60;
  for (let n = 0; n <= steps; n++) {
    const t = n / steps;
    const { s } = locate(segments, quote * t);
    points.push({ progressPct: t * 100, priceQuote: s * s });
  }

  return {
    source,
    segments,
    totalSupply,
    startPrice,
    migrationPrice,
    priceMultiple: migrationPrice / startPrice,
    tokensOnCurve: base,
    quoteToGraduate: quote,
    points,
  };
}

/** Simplified single-segment model, used only if the real launch config can't be built. */
export function estimateModel(input: {
  startMcap: number;
  migrationMcap: number;
  totalSupply: number;
  percentSold?: number;
}): CurveModel | null {
  const { startMcap, migrationMcap, totalSupply } = input;
  const pct = input.percentSold ?? 80;
  if (![startMcap, migrationMcap, totalSupply, pct].every(Number.isFinite)) return null;
  if (startMcap <= 0 || migrationMcap <= startMcap || totalSupply <= 0 || pct <= 0 || pct > 100) return null;
  const s0 = Math.sqrt(startMcap / totalSupply);
  const s1 = Math.sqrt(migrationMcap / totalSupply);
  const l = ((totalSupply * pct) / 100) / (1 / s0 - 1 / s1);
  return modelFromSegments([{ sa: s0, sb: s1, l }], totalSupply, "estimate");
}

export interface BuyResult {
  tokensOut: number;
  quoteSpent: number;
  avgPrice: number;
  endPrice: number;
  priceImpactPct: number;
  endProgressPct: number;
  graduates: boolean;
}

/** Simulates a buy of `quoteIn` when the curve is already `fromProgressPct` filled. */
export function simulateBuy(
  m: CurveModel,
  feeBps: number,
  quoteIn: number,
  fromProgressPct = 0
): BuyResult | null {
  if (!Number.isFinite(quoteIn) || quoteIn <= 0) return null;
  const feeFactor = 1 - Math.min(Math.max(feeBps, 0), 5000) / 10000;
  const q0 = (Math.min(Math.max(fromProgressPct, 0), 99.9) / 100) * m.quoteToGraduate;
  const netIn = quoteIn * feeFactor;
  const graduates = q0 + netIn >= m.quoteToGraduate;
  const q1 = graduates ? m.quoteToGraduate : q0 + netIn;
  const quoteSpent = graduates ? (m.quoteToGraduate - q0) / feeFactor : quoteIn;

  const a = locate(m.segments, q0);
  const b = locate(m.segments, q1);
  const tokensOut = b.base - a.base;
  if (!(tokensOut > 0)) return null;

  return {
    tokensOut,
    quoteSpent,
    avgPrice: quoteSpent / tokensOut,
    endPrice: b.s * b.s,
    priceImpactPct: ((b.s * b.s) / (a.s * a.s) - 1) * 100,
    endProgressPct: (q1 / m.quoteToGraduate) * 100,
    graduates,
  };
}

export interface Milestone {
  progressPct: number;
  quoteRaised: number;
  tokensSold: number;
  price: number;
  marketCap: number;
}

export function milestones(m: CurveModel, steps = [10, 25, 50, 75, 90, 100]): Milestone[] {
  return steps.map((p) => {
    const q = (p / 100) * m.quoteToGraduate;
    const { s, base } = locate(m.segments, q);
    return { progressPct: p, quoteRaised: q, tokensSold: base, price: s * s, marketCap: s * s * m.totalSupply };
  });
}

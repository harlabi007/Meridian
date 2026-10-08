/**
 * Named curve-shape presets for Curve Studio, matching Meteora's own suggested directions
 * ("Flat Curve, Exponential Curve or Long Curve" — see the DBC hackathon listing).
 *
 * Important honesty note: DBC's market-cap-based curve builder always produces the same kind
 * of underlying shape (a single constant-liquidity segment, sqrt-price-linear) — it does not
 * expose multi-segment curve authoring through the simple initial/migration-market-cap inputs
 * this app uses. What genuinely differs between these presets is the *behavior* a trader
 * experiences: how much the price moves, how expensive it is to reach graduation, and how much
 * capital the curve can absorb before migrating — all real, verified differences produced by
 * the same tested math, not cosmetic labels on an identical curve.
 */
export interface CurvePreset {
  id: string;
  label: string;
  tagline: string;
  description: string;
  startMcap: number;
  migrationMcap: number;
  totalSupply: number;
  feeBps: number;
}

export const CURVE_PRESETS: CurvePreset[] = [
  {
    id: "flat",
    label: "Flat Curve",
    tagline: "Gentle price movement",
    description:
      "A narrow gap between the starting and migration price. Early and late buyers pay close to the same price — good for tokens meant to feel stable rather than speculative, or for teams who don't want early buyers holding a huge unrealized edge over everyone else.",
    startMcap: 20,
    migrationMcap: 60,
    totalSupply: 1_000_000_000,
    feeBps: 150,
  },
  {
    id: "exponential",
    label: "Exponential Curve",
    tagline: "Steep, high-conviction launch",
    description:
      "A large gap between starting and migration price. Early buyers get significant upside if the token gains traction, and the price accelerates sharply as the curve fills — the classic high-risk, high-reward fair-launch shape.",
    startMcap: 3,
    migrationMcap: 500,
    totalSupply: 1_000_000_000,
    feeBps: 400,
  },
  {
    id: "long",
    label: "Long Curve",
    tagline: "Extended, high-capacity raise",
    description:
      "A high migration target with a large supply, so the curve can absorb substantially more capital before graduating. Suited to projects expecting sustained demand over time rather than a fast pump — the tradeoff is it takes much more volume to reach migration.",
    startMcap: 10,
    migrationMcap: 2000,
    totalSupply: 10_000_000_000,
    feeBps: 300,
  },
];

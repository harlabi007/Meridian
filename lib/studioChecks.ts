import { simulateBuy, type CurveModel } from "./curve";

export interface StudioInputs {
  startMcap: number;
  migrationMcap: number;
  totalSupply: number;
  startingFeeBps: number;
}

export type CheckLevel = "error" | "warn" | "ok";
export interface Check {
  level: CheckLevel;
  title: string;
  detail: string;
}

export const LIMITS = {
  supplyMin: 1_000_000,
  // SPL amounts are u64; at 6 decimals the largest safe whole-token supply is ~1.8e13
  supplyMax: 10_000_000_000_000,
  feeMin: 100,
  feeMax: 1000,
  mcapMin: 0.1,
} as const;

/** Hard errors: configurations that cannot be launched. */
export function validateInputs(i: StudioInputs): Check[] {
  const errors: Check[] = [];
  const err = (title: string, detail: string) => errors.push({ level: "error", title, detail });

  if (![i.startMcap, i.migrationMcap, i.totalSupply, i.startingFeeBps].every(Number.isFinite)) {
    err("Enter valid numbers", "Every field needs a number.");
    return errors;
  }
  if (i.startMcap < LIMITS.mcapMin) {
    err("Starting market cap is too low", `Use at least ${LIMITS.mcapMin} SOL.`);
  }
  if (i.migrationMcap <= i.startMcap) {
    err("Migration market cap must be higher", "The pool graduates when it reaches the migration market cap, so it has to be above the starting one.");
  }
  if (i.totalSupply < LIMITS.supplyMin) {
    err("Total supply is too small", `Use at least ${LIMITS.supplyMin.toLocaleString()} tokens.`);
  }
  if (i.totalSupply > LIMITS.supplyMax) {
    err("Total supply is too large", `The maximum supported supply is ${LIMITS.supplyMax.toLocaleString()} tokens.`);
  }
  if (i.startingFeeBps < LIMITS.feeMin || i.startingFeeBps > LIMITS.feeMax) {
    err("Starting fee out of range", `Choose between ${LIMITS.feeMin / 100}% and ${LIMITS.feeMax / 100}%.`);
  }
  return errors;
}

/** Review checklist: honest signals about how the curve will behave. */
export function analyzeModel(m: CurveModel, i: StudioInputs): Check[] {
  const checks: Check[] = [];
  const add = (level: CheckLevel, title: string, detail: string) => checks.push({ level, title, detail });

  const mult = m.priceMultiple;
  if (mult > 1000) {
    add("warn", `Very steep price range (${mult.toFixed(0)}x)`, "Early buyers see enormous upside on paper, but late buyers face a very expensive curve. Consider a lower migration market cap.");
  } else if (mult < 3) {
    add("warn", `Narrow price range (${mult.toFixed(1)}x)`, "There is little room for the price to move between launch and graduation.");
  } else {
    add("ok", `Price range ${mult.toFixed(1)}x`, "A healthy spread between the starting and migration price.");
  }

  const raise = m.quoteToGraduate;
  if (raise < 10) {
    add("warn", `Cheap to graduate (${raise.toFixed(1)} SOL)`, "A single wallet could push this pool to graduation on its own.");
  } else if (raise > 1000) {
    add("warn", `Expensive to graduate (${raise.toFixed(0)} SOL)`, "Reaching migration will take a lot of demand; many pools stall well before it.");
  } else {
    add("ok", `${raise.toFixed(1)} SOL raised at graduation`, "A realistic amount of demand to reach migration.");
  }

  const first = simulateBuy(m, i.startingFeeBps, 1, 0);
  if (first && first.priceImpactPct > 50) {
    add("warn", `Thin early liquidity (${first.priceImpactPct.toFixed(0)}% impact on a 1 SOL buy)`, "The first buys move the price sharply. Raise the starting market cap or lower the migration cap to soften this.");
  } else if (first) {
    add("ok", `1 SOL buy moves the price ${first.priceImpactPct.toFixed(1)}%`, "Early trades won't swing the price wildly.");
  }

  if (i.startingFeeBps >= 500) {
    add("warn", `High launch fee (${(i.startingFeeBps / 100).toFixed(1)}%)`, "Strong sniper protection, but it discourages early buyers until the fee decays.");
  } else {
    add("ok", `Launch fee ${(i.startingFeeBps / 100).toFixed(1)}% decaying to 1%`, "The fee falls linearly to 1% over the first hour, which discourages sniping.");
  }

  if (m.source === "estimate") {
    add("ok", "Showing a verified estimate", "These numbers come from a simplified model of your curve. The small padding/rounding Meteora applies on-chain isn't reflected here, so treat this as accurate to within a percent or two, not to the decimal.");
  }
  return checks;
}

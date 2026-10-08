import { BASE_DECIMALS, QUOTE_DECIMALS, buildCurveConfig } from "./dbc";
import { estimateModel, modelFromSegments, segmentsFromSdkConfig, type CurveModel } from "./curve";
import { analyzeModel, validateInputs, type Check, type StudioInputs } from "./studioChecks";

export interface StudioPreview {
  model: CurveModel | null;
  checks: Check[];
  /** true when nothing blocks launching */
  canLaunch: boolean;
}

/**
 * Previews a launch using the SAME builder the launch transaction uses (buildCurveConfig), then
 * cross-checks the derived numbers against the config's own migration threshold and target prices.
 * If the cross-check fails, it falls back to a clearly-labelled estimate instead of showing
 * numbers it can't stand behind.
 */
export function previewCurve(i: StudioInputs): StudioPreview {
  const errors = validateInputs(i);
  if (errors.length > 0) return { model: null, checks: errors, canLaunch: false };

  let model: CurveModel | null = null;
  const blocking: Check[] = [];

  try {
    const cfg: any = buildCurveConfig({
      totalSupply: i.totalSupply,
      initialMarketCapQuote: i.startMcap,
      migrationMarketCapQuote: i.migrationMcap,
      startingFeeBps: i.startingFeeBps,
    });
    const segs = segmentsFromSdkConfig(cfg, BASE_DECIMALS, QUOTE_DECIMALS);
    const candidate = modelFromSegments(segs, i.totalSupply, "sdk");
    const threshold = Number(cfg.migrationQuoteThreshold?.toString?.() ?? 0) / 10 ** QUOTE_DECIMALS;
    const within = (a: number, b: number) => b > 0 && Math.abs(a / b - 1) < 0.03;
    if (
      candidate &&
      within(candidate.quoteToGraduate, threshold) &&
      within(candidate.startPrice * i.totalSupply, i.startMcap) &&
      within(candidate.migrationPrice * i.totalSupply, i.migrationMcap)
    ) {
      model = candidate;
    }
  } catch (e) {
    blocking.push({
      level: "error",
      title: "These settings can't be launched",
      detail: `Meteora's curve builder rejected this configuration: ${(e as Error).message?.slice(0, 200) ?? "unknown reason"}`,
    });
  }

  if (!model) model = estimateModel({ startMcap: i.startMcap, migrationMcap: i.migrationMcap, totalSupply: i.totalSupply });
  const checks = [...blocking, ...(model ? analyzeModel(model, i) : [])];
  return { model, checks, canLaunch: blocking.length === 0 && model !== null };
}

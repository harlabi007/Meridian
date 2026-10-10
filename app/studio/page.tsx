"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CurveChart } from "@/components/CurveChart";
import { StatPill } from "@/components/StatPill";
import { previewCurve } from "@/lib/studio";
import { simulateBuy, milestones } from "@/lib/curve";
import { LIMITS } from "@/lib/studioChecks";
import { CURVE_PRESETS } from "@/lib/curvePresets";
import { fmtCompact, fmtMultiple, fmtPct, fmtQuote } from "@/lib/format";

const PRESET_BUYS = [0.1, 0.5, 1, 5, 10];

export default function CurveStudioPage() {
  const [startMcap, setStartMcap] = useState("5");
  const [migrationMcap, setMigrationMcap] = useState("300");
  const [supply, setSupply] = useState("1000000000");
  const [feeBps, setFeeBps] = useState(300);
  const [buySize, setBuySize] = useState("1");
  const [filled, setFilled] = useState(0);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyPreset(p: (typeof CURVE_PRESETS)[number]) {
    setStartMcap(String(p.startMcap));
    setMigrationMcap(String(p.migrationMcap));
    setSupply(String(p.totalSupply));
    setFeeBps(p.feeBps);
    setActivePreset(p.id);
  }

  const inputs = {
    startMcap: Number(startMcap),
    migrationMcap: Number(migrationMcap),
    totalSupply: Number(supply),
    startingFeeBps: feeBps,
  };
  const preview = useMemo(
    () => previewCurve(inputs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startMcap, migrationMcap, supply, feeBps]
  );
  const { model, checks, canLaunch } = preview;
  const errors = checks.filter((c) => c.level === "error");
  const notes = checks.filter((c) => c.level !== "error");

  const custom = model ? simulateBuy(model, feeBps, Number(buySize), filled) : null;
  const rows = model ? PRESET_BUYS.map((size) => ({ size, r: simulateBuy(model, feeBps, size, filled) })) : [];
  const stages = model ? milestones(model) : [];

  const launchHref = `/create?start=${encodeURIComponent(startMcap)}&migrate=${encodeURIComponent(migrationMcap)}&supply=${encodeURIComponent(supply)}&fee=${encodeURIComponent(feeBps)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Curve Studio</h1>
        <p className="text-muted text-sm leading-relaxed">
          Configure Meridian&apos;s Dynamic Bonding Curve, see exactly how it prices tokens from launch to graduation, and review it before you spend anything. This uses the same curve builder as the real launch, so what you see here is what gets deployed.
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium mb-3">Start from a shape</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CURVE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`text-left border rounded-lg p-4 transition-colors ${
                activePreset === p.id ? "border-amber bg-amber/5" : "border-border bg-panel hover:border-borderHi"
              }`}
            >
              <p className="text-sm font-medium mb-0.5">{p.label}</p>
              <p className="text-xs text-amber mb-2">{p.tagline}</p>
              <p className="text-xs text-muted leading-relaxed">{p.description}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-faint mt-2">
          Pick one as a starting point, then adjust the numbers below to fit your launch — every field stays editable.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border border-border rounded bg-panel p-4 h-fit">
          <h2 className="text-sm font-medium mb-4">1. Configure the curve</h2>

          <Field label="Starting market cap (SOL)">
            <input className="input font-mono" type="number" min={LIMITS.mcapMin} step="0.1" value={startMcap} onChange={(e) => { setStartMcap(e.target.value); setActivePreset(null); }} />
          </Field>
          <Field label="Migration market cap (SOL)" hint="The pool graduates to a DEX pool at this value.">
            <input className="input font-mono" type="number" min="0" step="1" value={migrationMcap} onChange={(e) => { setMigrationMcap(e.target.value); setActivePreset(null); }} />
          </Field>
          <Field label="Total token supply">
            <input className="input font-mono" type="number" min={LIMITS.supplyMin} max={LIMITS.supplyMax} value={supply} onChange={(e) => { setSupply(e.target.value); setActivePreset(null); }} />
          </Field>
          <Field label={`Starting trading fee: ${fmtPct(feeBps / 100)}`} hint="Decays linearly to 1% over the first hour — discourages sniping.">
            <input type="range" min={LIMITS.feeMin} max={LIMITS.feeMax} step="25" value={feeBps} onChange={(e) => { setFeeBps(Number(e.target.value)); setActivePreset(null); }} className="w-full accent-[var(--color-accent)]" />
          </Field>

          <h2 className="text-sm font-medium mt-6 mb-3">2. Review</h2>
          {errors.length > 0 ? (
            <ul className="space-y-2 mb-3">
              {errors.map((c) => (
                <li key={c.title} className="text-xs px-3 py-2 border border-sell/40 bg-sell/10 rounded text-sell">
                  <strong className="font-medium">{c.title}.</strong> {c.detail}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2 mb-3">
              {notes.map((c) => (
                <li key={c.title} className={`text-xs px-3 py-2 rounded border ${c.level === "warn" ? "border-amber/40 bg-amber/10 text-text" : "border-buy/30 bg-buy/10 text-buy"}`}>
                  <strong className="font-medium">{c.title}.</strong> <span className={c.level === "warn" ? "text-muted" : ""}>{c.detail}</span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="text-sm font-medium mt-6 mb-3">3. Launch</h2>
          <Link
            href={canLaunch ? launchHref : "#"}
            aria-disabled={!canLaunch}
            onClick={(e) => !canLaunch && e.preventDefault()}
            className={`block w-full text-center py-2.5 text-sm font-semibold rounded transition-colors ${canLaunch ? "bg-amber text-white hover:bg-amberHi" : "bg-panel2 text-faint cursor-not-allowed"}`}
          >
            {canLaunch ? "Continue to launch →" : "Fix the errors above to continue"}
          </Link>
          <p className="text-xs text-faint mt-3 leading-relaxed">
            {model?.source === "sdk" ? "Figures below are computed from the real launch configuration." : "Showing a simplified estimate — see the note above."}{" "}
            Fees and rounding are finalised on-chain at launch.
          </p>
        </div>

        <div className="lg:col-span-2">
          {!model ? (
            <div className="border border-border rounded bg-panel py-16 text-center px-6">
              <p className="text-sm font-medium mb-1">Fix the configuration to see a preview</p>
              <p className="text-sm text-muted">Resolve the errors on the left.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatPill label="Start price" value={fmtQuote(model.startPrice)} />
                <StatPill label="Migration price" value={fmtQuote(model.migrationPrice)} />
                <StatPill label="Price range" value={fmtMultiple(model.priceMultiple)} tone="buy" />
                <StatPill label="Raised to graduate" value={fmtQuote(model.quoteToGraduate)} />
              </div>

              <CurveChart points={model.points} currentProgressPct={custom ? custom.endProgressPct : filled} />
              <p className="text-xs text-faint mt-2">{fmtCompact(model.tokensOnCurve)} tokens sell along this curve; the rest seeds the DEX pool at graduation. The dot marks where your simulated buy ends.</p>

              <div className="mt-6 border border-border rounded overflow-x-auto">
                <div className="grid grid-cols-5 text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[720px]">
                  <span>Progress</span><span>SOL raised</span><span>Tokens sold</span><span>Price</span><span className="text-right">Market cap</span>
                </div>
                {stages.map((s) => (
                  <div key={s.progressPct} className="grid grid-cols-5 text-xs px-3 py-2 border-b border-border last:border-0 font-mono min-w-[720px]">
                    <span>{s.progressPct}%</span>
                    <span>{fmtQuote(s.quoteRaised)}</span>
                    <span>{fmtCompact(s.tokensSold)}</span>
                    <span>{fmtQuote(s.price)}</span>
                    <span className="text-right">{fmtQuote(s.marketCap)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 border border-border rounded bg-panel p-4">
                <h2 className="text-sm font-medium mb-4">Buy simulator</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <Field label="Buy size (SOL)">
                    <input className="input font-mono" type="number" min="0" step="0.1" value={buySize} onChange={(e) => setBuySize(e.target.value)} />
                  </Field>
                  <Field label={`Curve already filled: ${filled}%`} hint="See how buying later in the curve changes the result.">
                    <input type="range" min="0" max="95" value={filled} onChange={(e) => setFilled(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
                  </Field>
                </div>
                {custom ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatPill label="You receive" value={fmtCompact(custom.tokensOut)} />
                    <StatPill label="Average price" value={fmtQuote(custom.avgPrice)} />
                    <StatPill label="Price impact" value={fmtPct(custom.priceImpactPct)} tone={custom.priceImpactPct > 25 ? "sell" : "default"} />
                    <StatPill label="Curve after buy" value={custom.graduates ? "Graduates" : fmtPct(custom.endProgressPct)} />
                  </div>
                ) : (
                  <p className="text-sm text-muted">Enter a buy size to simulate.</p>
                )}
              </div>

              <div className="mt-6 border border-border rounded overflow-x-auto">
                <div className="grid grid-cols-5 text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[720px]">
                  <span>Buy</span><span>Tokens</span><span>Avg price</span><span>Impact</span><span className="text-right">Curve after</span>
                </div>
                {rows.map(({ size, r }) => (
                  <div key={size} className="grid grid-cols-5 text-xs px-3 py-2 border-b border-border last:border-0 font-mono min-w-[720px]">
                    <span>{size} SOL</span>
                    <span>{r ? fmtCompact(r.tokensOut) : "—"}</span>
                    <span>{r ? fmtQuote(r.avgPrice) : "—"}</span>
                    <span className="text-muted">{r ? fmtPct(r.priceImpactPct) : "—"}</span>
                    <span className="text-right text-muted">{r ? (r.graduates ? "Graduates" : fmtPct(r.endProgressPct)) : "—"}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs text-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-faint mt-1">{hint}</span>}
    </label>
  );
}

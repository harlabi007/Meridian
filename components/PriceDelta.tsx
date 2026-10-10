import { fmtPct } from "@/lib/format";

export function PriceDelta({ pct, size = "sm" }: { pct: number | null; size?: "sm" | "md" }) {
  if (pct === null || !Number.isFinite(pct)) {
    return <span className="text-faint text-xs">—</span>;
  }
  const up = pct >= 0;
  const cls = up ? "text-buy" : "text-sell";
  const text = size === "md" ? "text-sm" : "text-xs";
  return (
    <span className={`${cls} ${text} font-mono inline-flex items-center gap-0.5`}>
      {up ? "↗" : "↘"} {fmtPct(Math.abs(pct))}
    </span>
  );
}

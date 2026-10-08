import { fmtPct } from "@/lib/format";

export function ProgressBar({
  pct,
  label,
  size = "md",
}: {
  pct: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const height = size === "sm" ? "h-1" : "h-1.5";

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">{label}</span>
          <span className="text-xs font-mono text-text">{fmtPct(clamped)}</span>
        </div>
      )}
      <div className={`w-full ${height} bg-panel2 rounded-full overflow-hidden border border-border`}>
        <div
          className="h-full bg-amber rounded-full transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

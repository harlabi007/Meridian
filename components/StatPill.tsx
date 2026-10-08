export function StatPill({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: string;
  tone?: "default" | "buy" | "sell";
  sub?: React.ReactNode;
}) {
  const toneClass = tone === "buy" ? "text-buy" : tone === "sell" ? "text-sell" : "text-text";

  return (
    <div className="flex flex-col gap-1 px-4 py-3 border border-border rounded-lg bg-panel shadow-card">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-sm ${toneClass}`}>{value}</span>
        {sub}
      </div>
    </div>
  );
}

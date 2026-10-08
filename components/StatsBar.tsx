"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/lib/api";
import { fmtCompact, fmtQuote } from "@/lib/format";

export function StatsBar() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 30_000,
  });

  const show = (v: string) => {
    if (data) return <span className="font-mono text-2xl sm:text-3xl font-semibold text-text tracking-tight">{v}</span>;
    if (isLoading) return <span className="block h-6 w-16 mt-0.5 rounded bg-panel2 animate-pulse" aria-label="Loading" />;
    return <span className="text-sm text-faint">Unavailable</span>;
  };

  const items = [
    { label: "Tokens launched", node: show(data ? fmtCompact(data.totalPools).replace(/\.00$/, "") : "") },
    { label: "Migrated to DEX", node: show(data ? fmtCompact(data.migratedCount).replace(/\.00$/, "") : "") },
    { label: "Combined market cap", node: show(data ? fmtQuote(data.totalMarketCapQuote) : "") },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 border border-border rounded-lg bg-panel shadow-card divide-y sm:divide-y-0 sm:divide-x divide-border"
      title={isError ? "Stats are unavailable until the database is connected." : undefined}
    >
      {items.map((item) => (
        <div key={item.label} className="px-5 py-4 sm:px-7 sm:py-5">
          <div className="text-xs text-muted mb-1.5">{item.label}</div>
          {item.node}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TokenAvatar } from "@/components/TokenAvatar";
import { PriceDelta } from "@/components/PriceDelta";
import { ProgressBar } from "@/components/ProgressBar";
import { Logo } from "@/components/Logo";
import { fetchPool } from "@/lib/api";
import { fmtQuote } from "@/lib/format";

/**
 * A compact, chrome-free widget meant to be embedded via <iframe> on third-party sites
 * (a creator's own page, a Discord bot preview, a Notion doc). It intentionally does NOT
 * try to embed wallet-connected trading — wallet browser extensions are unreliable inside
 * iframes and would risk looking broken — so it shows live data with a link back to
 * Meridian to actually trade. Get the embed code from any pool's page.
 */
export default function EmbedPoolPage() {
  const { address } = useParams<{ address: string }>();
  const { data: pool, isLoading, isError } = useQuery({
    queryKey: ["embed-pool", address],
    queryFn: () => fetchPool(address),
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <div className="p-4 h-[120px] bg-panel2 animate-pulse" />;
  }
  if (isError || !pool) {
    return <div className="p-4 text-sm text-muted">This pool couldn&apos;t be loaded.</div>;
  }

  return (
    <div className="p-4 bg-panel">
      <div className="flex items-center gap-3 mb-3">
        <TokenAvatar symbol={pool.symbol} imageUrl={pool.imageUrl} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{pool.name}</p>
          <p className="text-xs font-mono text-muted">${pool.symbol}</p>
        </div>
        {pool.migrated && <span className="text-[10px] px-2 py-0.5 rounded bg-buy/10 text-buy border border-buy/30 shrink-0">Migrated</span>}
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-mono text-lg">{fmtQuote(pool.priceQuote)}</span>
        <PriceDelta pct={pool.priceChangePct24h} />
      </div>

      {!pool.migrated && (
        <div className="mb-3">
          <ProgressBar pct={pool.progressPct} size="sm" />
          <p className="text-[11px] text-faint mt-1">{pool.progressPct.toFixed(0)}% to migration</p>
        </div>
      )}

      <a
        href={`${typeof window !== "undefined" ? window.location.origin : ""}/pool/${pool.address}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 w-full py-2 bg-amber text-white text-xs font-semibold rounded hover:bg-amberHi transition-colors"
      >
        Trade on Meridian
      </a>
      <a href="/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-faint hover:text-muted">
        <Logo size={12} /> Powered by Meridian
      </a>
    </div>
  );
}

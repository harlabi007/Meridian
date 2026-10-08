"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { StatPill } from "@/components/StatPill";
import { ProgressBar } from "@/components/ProgressBar";
import { CurveChart } from "@/components/CurveChart";
import { SwapWidget } from "@/components/SwapWidget";
import { CreatorPanel } from "@/components/CreatorPanel";
import { WatchlistStar } from "@/components/WatchlistStar";
import { ShareButtons } from "@/components/ShareButtons";
import { EmbedCodeButton } from "@/components/EmbedCodeButton";
import { ReferralLinkButton } from "@/components/ReferralLinkButton";
import { CommentSection } from "@/components/CommentSection";
import { TokenAvatar } from "@/components/TokenAvatar";
import { ErrorPanel, Skeleton } from "@/components/DataState";
import { PriceDelta } from "@/components/PriceDelta";
import { fetchActivity, fetchPool } from "@/lib/api";
import { fmtCompact, fmtQuote, fmtTimeAgo, shortAddr } from "@/lib/format";

export default function PoolPage() {
  const { address } = useParams<{ address: string }>();
  const [displayImage, setDisplayImage] = useState<string | null>(null);

  const { data: pool, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pool", address],
    queryFn: () => fetchPool(address),
    refetchInterval: 15_000,
    retry: 1,
  });

  const { data: activity } = useQuery({
    queryKey: ["activity", address],
    queryFn: () => fetchActivity(address),
    enabled: Boolean(pool),
    refetchInterval: 20_000,
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-12 h-12" />
          <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-[220px]" />
      </div>
    );
  }
  if (isError || !pool) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-14">
        <ErrorPanel error={error} onRetry={() => refetch()} title={!pool && !isError ? "Pool not found" : undefined} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <TokenAvatar symbol={pool.symbol} imageUrl={displayImage ?? pool.imageUrl} size={48} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{pool.name}</h1>
              <span className="text-sm font-mono text-muted">${pool.symbol}</span>
              <WatchlistStar address={pool.address} size="md" />
            </div>
            <div className="text-xs text-faint mt-0.5">
              Created {fmtTimeAgo(pool.createdAt)} by{" "}
              <Link href={`/creator/${pool.creator}`} className="text-muted hover:text-text underline decoration-dotted">{shortAddr(pool.creator)}</Link>
            </div>
          </div>
        </div>
        {pool.migrated ? (
          <span className="text-xs px-2.5 py-1 rounded bg-buy/10 text-buy border border-buy/30">Migrated{pool.migratedTo ? ` to ${pool.migratedTo === "damm_v1" ? "DAMM v1" : "DAMM v2"}` : ""}</span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded bg-panel2 text-muted border border-border">Bonding — not yet migrated</span>
        )}
      </div>

      <div className="mb-6 flex items-center justify-between flex-wrap gap-2"><ShareButtons name={pool.name} symbol={pool.symbol} /><div className="flex gap-2"><ReferralLinkButton poolAddress={pool.address} /><EmbedCodeButton poolAddress={pool.address} /></div></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatPill label="Price" value={fmtQuote(pool.priceQuote)} sub={<PriceDelta pct={pool.priceChangePct24h} size="md" />} />
        <StatPill label="Market cap" value={fmtQuote(pool.marketCapQuote)} />
        <StatPill label="Quote reserve" value={fmtQuote(pool.quoteReserve)} />
        <StatPill label="Holders" value={pool.holderCount > 0 ? fmtCompact(pool.holderCount) : "—"} />
      </div>

      <CreatorPanel poolAddress={pool.address} creator={pool.creator} imageUrl={displayImage ?? pool.imageUrl} onImageUpdated={setDisplayImage} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="mb-4"><ProgressBar pct={pool.progressPct} label={`Progress to ${fmtQuote(pool.migrationThresholdQuote)} migration threshold`} /></div>
          <CurveChart points={pool.curvePoints} currentProgressPct={pool.progressPct} />

          <div className="mt-6">
            <h2 className="text-sm font-medium mb-3">Recent activity</h2>
            <div className="border border-border rounded overflow-x-auto">
              {activity?.source === "events" && activity.trades && activity.trades.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[420px]">
                    <span>Side</span><span>Trader</span><span>Amount</span><span className="text-right">Time</span>
                  </div>
                  {activity.trades.slice(0, 15).map((t) => (
                    <a key={t.id} href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer" className="grid grid-cols-4 text-xs px-3 py-2 border-b border-border last:border-0 font-mono hover:bg-panel2 transition-colors min-w-[420px]">
                      <span className={t.side === "buy" ? "text-buy" : "text-sell"}>{t.side === "buy" ? "Buy" : "Sell"}</span>
                      <Link href={`/creator/${t.trader}`} onClick={(e) => e.stopPropagation()} className="text-muted hover:text-text">{shortAddr(t.trader)}</Link>
                      <span>{fmtQuote(t.quoteAmount)}</span>
                      <span className="text-right text-faint">{fmtTimeAgo(t.timestamp)}</span>
                    </a>
                  ))}
                </>
              ) : activity?.source === "snapshots" && activity.snapshots && activity.snapshots.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[420px]">
                    <span>Price</span><span>Progress</span><span className="text-right">Time</span>
                  </div>
                  {activity.snapshots.slice(0, 12).map((s, i) => (
                    <div key={i} className="grid grid-cols-3 text-xs px-3 py-2 border-b border-border last:border-0 font-mono min-w-[420px]">
                      <span>{fmtQuote(s.priceQuote)}</span><span className="text-muted">{s.progressPct.toFixed(1)}%</span><span className="text-right text-faint">{fmtTimeAgo(s.takenAt)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="px-3 py-8 text-sm text-faint text-center min-w-[420px]">No trades yet — be the first to buy.</div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <CommentSection poolAddress={pool.address} />
          </div>
        </div>

        <div><SwapWidget poolAddress={pool.address} symbol={pool.symbol} migrated={pool.migrated} baseMint={pool.baseMint} /></div>
      </div>
    </div>
  );
}

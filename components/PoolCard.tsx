import Link from "next/link";
import { ProgressBar } from "./ProgressBar";
import { WatchlistStar } from "./WatchlistStar";
import { TokenAvatar } from "./TokenAvatar";
import { PriceDelta } from "./PriceDelta";
import { fmtPct, fmtQuote, fmtTimeAgo, shortAddr } from "@/lib/format";
import type { PoolSummary } from "@/lib/types";

export function PoolCard({ pool, trending }: { pool: PoolSummary; trending?: boolean }) {
  return (
    <Link
      href={`/pool/${pool.address}`}
      className="block border border-border rounded-lg bg-panel hover:border-borderHi hover:shadow-elevated transition-all duration-150 p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <TokenAvatar symbol={pool.symbol} imageUrl={pool.imageUrl} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="font-medium text-sm truncate">{pool.name}</div>
              {trending && (
                <span className="text-[10px] px-1.5 py-px rounded bg-amber/10 text-amber border border-amber/30 shrink-0">
                  🔥 Trending
                </span>
              )}
            </div>
            <div className="text-xs text-muted font-mono">${pool.symbol}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <WatchlistStar address={pool.address} />
          {pool.migrated ? (
            <span className="text-xs px-2 py-0.5 rounded bg-buy/10 text-buy border border-buy/30">
              Migrated
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-panel2 text-muted border border-border">
              Bonding
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div>
          <div className="text-muted mb-0.5">Price</div>
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-mono text-text">{fmtQuote(pool.priceQuote)}</span>
            <PriceDelta pct={pool.priceChangePct24h} />
          </div>
        </div>
        <div>
          <div className="text-muted mb-0.5">Market cap</div>
          <div className="font-mono text-text">{fmtQuote(pool.marketCapQuote)}</div>
        </div>
        <div>
          <div className="text-muted mb-0.5">24h volume</div>
          <div className="font-mono text-text">{fmtQuote(pool.volume24hQuote)}</div>
        </div>
        <div>
          <div className="text-muted mb-0.5">Creator</div>
          <div className="font-mono text-text">{shortAddr(pool.creator)}</div>
        </div>
      </div>

      <ProgressBar pct={pool.progressPct} size="sm" />
      <div className="flex justify-between mt-3 text-xs text-faint">
        <span>{fmtTimeAgo(pool.createdAt)}</span>
        <span>{fmtPct(pool.progressPct)} to migration</span>
      </div>
    </Link>
  );
}

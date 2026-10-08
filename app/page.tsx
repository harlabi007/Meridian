"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PoolCard } from "@/components/PoolCard";
import { StatsBar } from "@/components/StatsBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ErrorPanel, EmptyPanel, Skeleton } from "@/components/DataState";
import { fetchPools } from "@/lib/api";
import { useWatchlist } from "@/lib/watchlist";

type SortKey = "recent" | "progress" | "marketcap";

export default function ExplorePage() {
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [watchOnly, setWatchOnly] = useState(false);
  const { list: watchlist } = useWatchlist();

  const { data: pools, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pools", sort],
    queryFn: () => fetchPools({ sort }),
    refetchInterval: 20_000,
  });

  const trendingSet = useMemo(() => {
    if (!pools) return new Set<string>();
    return new Set(
      [...pools].filter((p) => p.volume24hQuote > 0).sort((a, b) => b.volume24hQuote - a.volume24hQuote).slice(0, 3).map((p) => p.address)
    );
  }, [pools]);

  const filtered = useMemo(() => {
    if (!pools) return pools;
    const q = query.trim().toLowerCase();
    return pools.filter((p) => {
      if (watchOnly && !watchlist.includes(p.address)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q);
    });
  }, [pools, query, watchOnly, watchlist]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">
      <section className="py-16 md:py-24 border-b border-border">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.08] mb-5">
            Launch a token on a fair bonding curve, watch it trade in real time.
          </h1>
          <p className="text-muted text-base leading-relaxed mb-8">
            Meridian wraps a Dynamic Bonding Curve in a live terminal: configure a curve, mint a pool, and track price, progress to migration, and every trade from one dashboard.
          </p>
          <div className="flex gap-3 mb-10">
            <Link href="/create" className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors">Launch a token</Link>
            <Link href="/studio" className="px-4 py-2 border border-border text-sm rounded text-muted hover:text-text hover:border-borderHi transition-colors">Try Curve Studio</Link>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2"><StatsBar /></div>
          <ActivityFeed />
        </div>
      </section>

      <section className="py-8">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-sm font-medium text-text">Live pools</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or symbol…" aria-label="Search pools" className="input w-48 text-xs py-1.5" />
            <button onClick={() => setWatchOnly((v) => !v)} aria-pressed={watchOnly} className={`px-2.5 py-1 rounded border text-xs transition-colors ${watchOnly ? "border-amber text-amber" : "border-border text-muted hover:text-text"}`}>
              ★ Watchlist{watchlist.length > 0 ? ` (${watchlist.length})` : ""}
            </button>
            <div className="flex gap-1 text-xs flex-wrap">
              {(["recent", "progress", "marketcap"] as const).map((key) => (
                <button key={key} onClick={() => setSort(key)} className={`px-2.5 py-1 rounded border transition-colors ${sort === key ? "border-amber text-amber" : "border-border text-muted hover:text-text"}`}>
                  {key === "recent" ? "Newest" : key === "progress" ? "Closest to migrating" : "Market cap"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[168px]" />)}
          </div>
        )}
        {isError && <ErrorPanel error={error} onRetry={() => refetch()} />}
        {pools && pools.length === 0 && (
          <EmptyPanel title="No pools yet" body="Be the first to launch a token on this curve." action={<Link href="/create" className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors">Launch a token</Link>} />
        )}
        {pools && pools.length > 0 && filtered && filtered.length === 0 && (
          <EmptyPanel title={watchOnly ? "Your watchlist is empty" : "No matches"} body={watchOnly ? "Tap the star on any pool to track it here." : "Try a different name or symbol."} />
        )}
        {filtered && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => <PoolCard key={p.address} pool={p} trending={trendingSet.has(p.address)} />)}
          </div>
        )}
      </section>
    </div>
  );
}
